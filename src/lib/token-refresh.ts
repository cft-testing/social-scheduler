import { Channel, Provider } from "@prisma/client";
import { decrypt, encrypt } from "./crypto";
import { prisma } from "./db";

export interface TokenRefreshResult {
  success: boolean;
  newToken?: string;
  newRefreshToken?: string;
  expiresAt?: Date;
  error?: string;
}

/**
 * Refresh a Meta (Facebook) long-lived access token.
 * Meta long-lived tokens can be exchanged for new ones before they expire.
 */
export async function refreshMetaToken(channel: Channel): Promise<TokenRefreshResult> {
  if (!channel.tokenEncrypted) {
    return { success: false, error: "No token to refresh" };
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    return { success: false, error: "Meta app credentials not configured" };
  }

  try {
    const currentToken = decrypt(channel.tokenEncrypted);

    const url = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
    url.searchParams.set("grant_type", "fb_exchange_token");
    url.searchParams.set("client_id", appId);
    url.searchParams.set("client_secret", appSecret);
    url.searchParams.set("fb_exchange_token", currentToken);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.error) {
      return {
        success: false,
        error: data.error.message || "Token refresh failed",
      };
    }

    const newToken = data.access_token;
    const expiresIn = data.expires_in || 5184000; // Default 60 days
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    return {
      success: true,
      newToken,
      expiresAt,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Refresh a LinkedIn access token using the refresh token.
 */
export async function refreshLinkedInToken(channel: Channel): Promise<TokenRefreshResult> {
  if (!channel.refreshTokenEncrypted) {
    return { success: false, error: "No refresh token available" };
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return { success: false, error: "LinkedIn app credentials not configured" };
  }

  try {
    const refreshToken = decrypt(channel.refreshTokenEncrypted);

    const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      return {
        success: false,
        error: data.error_description || data.error || "Token refresh failed",
      };
    }

    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    return {
      success: true,
      newToken: data.access_token,
      newRefreshToken: data.refresh_token,
      expiresAt,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Refresh a channel's token based on its provider.
 * Updates the database with the new token if successful.
 */
export async function refreshChannelToken(channel: Channel): Promise<TokenRefreshResult> {
  const result =
    channel.provider === Provider.META
      ? await refreshMetaToken(channel)
      : await refreshLinkedInToken(channel);

  if (result.success && result.newToken) {
    const updateData: {
      tokenEncrypted: string;
      expiresAt: Date | null;
      needsReconnect: boolean;
      refreshTokenEncrypted?: string;
    } = {
      tokenEncrypted: encrypt(result.newToken),
      expiresAt: result.expiresAt || null,
      needsReconnect: false,
    };

    if (result.newRefreshToken) {
      updateData.refreshTokenEncrypted = encrypt(result.newRefreshToken);
    }

    await prisma.channel.update({
      where: { id: channel.id },
      data: updateData,
    });
  }

  return result;
}
