import { NextResponse } from "next/server";
import { requireAuthApi } from "@/lib/auth-guard";

export async function GET() {
  const { error } = await requireAuthApi();
  if (error) return error;

  return NextResponse.json({
    metaConfigured: !!(process.env.META_APP_ID && process.env.META_APP_SECRET),
    linkedinConfigured: !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET),
  });
}
