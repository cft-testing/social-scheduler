import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth-guard";
import { generateOAuthState } from "@/lib/oauth-state";

// LinkedIn scopes
// w_organization_social requires LinkedIn Partner Program approval for production
const LINKEDIN_SCOPES = [
  "openid",
  "profile",
  "w_member_social",
  // "w_organization_social", // Uncomment when approved
].join(" ");

export async function GET() {
  const { session, error } = await requireRoleApi("ADMIN");
  if (error) return error;

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI || `${process.env.APP_URL}/api/channels/linkedin/callback`;

  if (!clientId) {
    return NextResponse.redirect(
      new URL("/channels?error=" + encodeURIComponent("LINKEDIN_CLIENT_ID não configurado"), process.env.APP_URL!)
    );
  }

  const state = await generateOAuthState(session!.user.workspaceId, "LINKEDIN");

  const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", LINKEDIN_SCOPES);
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl.toString());
}
