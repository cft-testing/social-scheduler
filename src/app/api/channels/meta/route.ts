import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth-guard";
import { generateOAuthState } from "@/lib/oauth-state";

const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
].join(",");

export async function GET() {
  const { session, error } = await requireRoleApi("ADMIN");
  if (error) return error;

  const appId = process.env.META_APP_ID;
  const redirectUri = process.env.META_REDIRECT_URI || `${process.env.APP_URL}/api/channels/meta/callback`;

  if (!appId) {
    return NextResponse.redirect(
      new URL("/channels?error=" + encodeURIComponent("META_APP_ID não configurado"), process.env.APP_URL!)
    );
  }

  const state = await generateOAuthState(session!.user.workspaceId, "META");

  const authUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");
  authUrl.searchParams.set("client_id", appId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", META_SCOPES);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("response_type", "code");

  return NextResponse.redirect(authUrl.toString());
}
