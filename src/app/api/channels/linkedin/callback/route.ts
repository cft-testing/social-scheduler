import { NextRequest, NextResponse } from "next/server";
import { validateOAuthState } from "@/lib/oauth-state";
import { encrypt } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { ChannelType, Provider } from "@prisma/client";

interface LinkedInUserInfo {
  sub: string;
  name?: string;
  email?: string;
  picture?: string;
}

interface LinkedInOrganization {
  organization: string; // URN format: urn:li:organization:12345
  "organization~"?: {
    localizedName: string;
    vanityName?: string;
  };
}

function getRedirectUrl(path: string): string {
  return `${process.env.APP_URL}${path}`;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  // Handle OAuth errors
  if (error) {
    const message = errorDescription || error;
    return NextResponse.redirect(getRedirectUrl(`/channels?error=${encodeURIComponent(message)}`));
  }

  // Validate state
  if (!state) {
    return NextResponse.redirect(getRedirectUrl("/channels?error=Estado+inválido"));
  }

  const statePayload = await validateOAuthState(state);
  if (!statePayload || statePayload.provider !== "LINKEDIN") {
    return NextResponse.redirect(getRedirectUrl("/channels?error=Sessão+expirada,+tente+novamente"));
  }

  // Validate code
  if (!code) {
    return NextResponse.redirect(getRedirectUrl("/channels?error=Código+de+autorização+não+recebido"));
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI || `${process.env.APP_URL}/api/channels/linkedin/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(getRedirectUrl("/channels?error=Credenciais+LinkedIn+não+configuradas"));
  }

  try {
    // Step 1: Exchange code for access token
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || tokenData.error) {
      console.error("[LinkedIn OAuth] Token exchange error:", tokenData);
      const message = tokenData.error_description || tokenData.error || "Erro na troca de token";
      return NextResponse.redirect(getRedirectUrl(`/channels?error=${encodeURIComponent(message)}`));
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in || 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // Step 2: Fetch user profile
    const userInfoRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const userInfo: LinkedInUserInfo = await userInfoRes.json();

    if (!userInfo.sub) {
      console.error("[LinkedIn OAuth] User info error:", userInfo);
      return NextResponse.redirect(getRedirectUrl("/channels?error=Não+foi+possível+obter+perfil"));
    }

    const workspaceId = statePayload.workspaceId;
    let channelsCreated = 0;

    // Create personal profile channel
    const profileName = userInfo.name || `LinkedIn ${userInfo.sub}`;

    await prisma.channel.upsert({
      where: {
        id: `li-profile-${userInfo.sub}-${workspaceId}`,
      },
      create: {
        id: `li-profile-${userInfo.sub}-${workspaceId}`,
        workspaceId,
        provider: Provider.LINKEDIN,
        type: ChannelType.LI_PROFILE,
        name: profileName,
        externalId: userInfo.sub,
        tokenEncrypted: encrypt(accessToken),
        refreshTokenEncrypted: refreshToken ? encrypt(refreshToken) : null,
        expiresAt,
        connected: true,
        needsReconnect: false,
        metadataJson: JSON.stringify({
          personId: userInfo.sub,
          name: userInfo.name,
          email: userInfo.email,
          picture: userInfo.picture,
        }),
      },
      update: {
        name: profileName,
        tokenEncrypted: encrypt(accessToken),
        refreshTokenEncrypted: refreshToken ? encrypt(refreshToken) : null,
        expiresAt,
        connected: true,
        needsReconnect: false,
        metadataJson: JSON.stringify({
          personId: userInfo.sub,
          name: userInfo.name,
          email: userInfo.email,
          picture: userInfo.picture,
        }),
      },
    });
    channelsCreated++;

    // Step 3: Try to fetch organizations (may fail if scope not approved)
    try {
      const orgsRes = await fetch(
        "https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organization~(localizedName,vanityName)))",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (orgsRes.ok) {
        const orgsData = await orgsRes.json();
        const orgs: LinkedInOrganization[] = orgsData.elements || [];

        for (const org of orgs) {
          // Extract org ID from URN (urn:li:organization:12345 -> 12345)
          const orgIdMatch = org.organization.match(/urn:li:organization:(\d+)/);
          if (!orgIdMatch) continue;

          const orgId = orgIdMatch[1];
          const orgName = org["organization~"]?.localizedName || `Organization ${orgId}`;

          await prisma.channel.upsert({
            where: {
              id: `li-org-${orgId}-${workspaceId}`,
            },
            create: {
              id: `li-org-${orgId}-${workspaceId}`,
              workspaceId,
              provider: Provider.LINKEDIN,
              type: ChannelType.LI_ORG,
              name: orgName,
              externalId: orgId,
              tokenEncrypted: encrypt(accessToken),
              refreshTokenEncrypted: refreshToken ? encrypt(refreshToken) : null,
              expiresAt,
              connected: true,
              needsReconnect: false,
              metadataJson: JSON.stringify({
                organizationId: orgId,
                organizationName: orgName,
                vanityName: org["organization~"]?.vanityName,
              }),
            },
            update: {
              name: orgName,
              tokenEncrypted: encrypt(accessToken),
              refreshTokenEncrypted: refreshToken ? encrypt(refreshToken) : null,
              expiresAt,
              connected: true,
              needsReconnect: false,
              metadataJson: JSON.stringify({
                organizationId: orgId,
                organizationName: orgName,
                vanityName: org["organization~"]?.vanityName,
              }),
            },
          });
          channelsCreated++;
        }
      }
    } catch (orgError) {
      // Organization access may not be available - this is not fatal
      console.log("[LinkedIn OAuth] Could not fetch organizations (may need partner approval):", orgError);
    }

    return NextResponse.redirect(getRedirectUrl(`/channels?success=linkedin&count=${channelsCreated}`));
  } catch (err) {
    console.error("[LinkedIn OAuth] Unexpected error:", err);
    return NextResponse.redirect(getRedirectUrl("/channels?error=Erro+inesperado+na+autenticação"));
  }
}
