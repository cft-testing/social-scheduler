import { NextRequest, NextResponse } from "next/server";
import { validateOAuthState } from "@/lib/oauth-state";
import { encrypt } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { ChannelType, Provider } from "@prisma/client";

interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: {
    id: string;
  };
}

interface InstagramAccount {
  id: string;
  username: string;
  name?: string;
}

function getRedirectUrl(path: string): string {
  return `${process.env.APP_URL}${path}`;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorReason = url.searchParams.get("error_reason");

  // Handle OAuth errors
  if (error) {
    const message = errorReason || error;
    return NextResponse.redirect(getRedirectUrl(`/channels?error=${encodeURIComponent(message)}`));
  }

  // Validate state
  if (!state) {
    return NextResponse.redirect(getRedirectUrl("/channels?error=Estado+inválido"));
  }

  const statePayload = await validateOAuthState(state);
  if (!statePayload || statePayload.provider !== "META") {
    return NextResponse.redirect(getRedirectUrl("/channels?error=Sessão+expirada,+tente+novamente"));
  }

  // Validate code
  if (!code) {
    return NextResponse.redirect(getRedirectUrl("/channels?error=Código+de+autorização+não+recebido"));
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri = process.env.META_REDIRECT_URI || `${process.env.APP_URL}/api/channels/meta/callback`;

  if (!appId || !appSecret) {
    return NextResponse.redirect(getRedirectUrl("/channels?error=Credenciais+Meta+não+configuradas"));
  }

  try {
    // Step 1: Exchange code for short-lived access token
    const tokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error("[META OAuth] Token exchange error:", tokenData.error);
      return NextResponse.redirect(getRedirectUrl(`/channels?error=${encodeURIComponent(tokenData.error.message)}`));
    }

    const shortLivedToken = tokenData.access_token;

    // Step 2: Exchange for long-lived token
    const longLivedUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
    longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
    longLivedUrl.searchParams.set("client_id", appId);
    longLivedUrl.searchParams.set("client_secret", appSecret);
    longLivedUrl.searchParams.set("fb_exchange_token", shortLivedToken);

    const longLivedRes = await fetch(longLivedUrl.toString());
    const longLivedData = await longLivedRes.json();

    if (longLivedData.error) {
      console.error("[META OAuth] Long-lived token error:", longLivedData.error);
      return NextResponse.redirect(getRedirectUrl(`/channels?error=${encodeURIComponent(longLivedData.error.message)}`));
    }

    // Step 3: Fetch user's Facebook pages
    const pagesUrl = new URL("https://graph.facebook.com/v19.0/me/accounts");
    pagesUrl.searchParams.set("access_token", longLivedData.access_token);
    pagesUrl.searchParams.set("fields", "id,name,access_token,instagram_business_account");

    const pagesRes = await fetch(pagesUrl.toString());
    const pagesData = await pagesRes.json();

    if (pagesData.error) {
      console.error("[META OAuth] Pages fetch error:", pagesData.error);
      return NextResponse.redirect(getRedirectUrl(`/channels?error=${encodeURIComponent(pagesData.error.message)}`));
    }

    const pages: FacebookPage[] = pagesData.data || [];
    const workspaceId = statePayload.workspaceId;
    let channelsCreated = 0;

    for (const page of pages) {
      // Calculate token expiry (page tokens don't expire if app has Advanced Access)
      const expiresIn = longLivedData.expires_in || 5184000; // Default 60 days
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      // Create or update Facebook Page channel
      await prisma.channel.upsert({
        where: {
          id: `meta-fb-${page.id}-${workspaceId}`,
        },
        create: {
          id: `meta-fb-${page.id}-${workspaceId}`,
          workspaceId,
          provider: Provider.META,
          type: ChannelType.FB_PAGE,
          name: page.name,
          externalId: page.id,
          tokenEncrypted: encrypt(page.access_token),
          expiresAt,
          connected: true,
          needsReconnect: false,
          metadataJson: JSON.stringify({ pageId: page.id, pageName: page.name }),
        },
        update: {
          name: page.name,
          tokenEncrypted: encrypt(page.access_token),
          expiresAt,
          connected: true,
          needsReconnect: false,
          metadataJson: JSON.stringify({ pageId: page.id, pageName: page.name }),
        },
      });
      channelsCreated++;

      // If page has Instagram Business account, create IG channel
      if (page.instagram_business_account?.id) {
        const igId = page.instagram_business_account.id;

        // Fetch Instagram account details
        const igUrl = new URL(`https://graph.facebook.com/v19.0/${igId}`);
        igUrl.searchParams.set("fields", "id,username,name");
        igUrl.searchParams.set("access_token", page.access_token);

        const igRes = await fetch(igUrl.toString());
        const igData: InstagramAccount = await igRes.json();

        if (!igData.id) {
          console.error("[META OAuth] Instagram fetch error:", igData);
          continue;
        }

        const igName = igData.username || igData.name || `Instagram ${igId}`;

        await prisma.channel.upsert({
          where: {
            id: `meta-ig-${igId}-${workspaceId}`,
          },
          create: {
            id: `meta-ig-${igId}-${workspaceId}`,
            workspaceId,
            provider: Provider.META,
            type: ChannelType.IG_BUSINESS,
            name: igName,
            externalId: igId,
            tokenEncrypted: encrypt(page.access_token), // Use parent page token
            expiresAt,
            connected: true,
            needsReconnect: false,
            metadataJson: JSON.stringify({
              igUserId: igId,
              username: igData.username,
              parentPageId: page.id,
            }),
          },
          update: {
            name: igName,
            tokenEncrypted: encrypt(page.access_token),
            expiresAt,
            connected: true,
            needsReconnect: false,
            metadataJson: JSON.stringify({
              igUserId: igId,
              username: igData.username,
              parentPageId: page.id,
            }),
          },
        });
        channelsCreated++;
      }
    }

    if (channelsCreated === 0) {
      return NextResponse.redirect(getRedirectUrl("/channels?error=Nenhuma+página+encontrada.+Certifique-se+de+que+tem+páginas+Facebook+administradas."));
    }

    return NextResponse.redirect(getRedirectUrl(`/channels?success=meta&count=${channelsCreated}`));
  } catch (err) {
    console.error("[META OAuth] Unexpected error:", err);
    return NextResponse.redirect(getRedirectUrl("/channels?error=Erro+inesperado+na+autenticação"));
  }
}
