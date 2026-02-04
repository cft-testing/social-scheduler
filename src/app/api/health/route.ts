import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const checks: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      DATABASE_URL: process.env.DATABASE_URL ? "set (" + process.env.DATABASE_URL.substring(0, 30) + "...)" : "MISSING",
      AUTH_SECRET: process.env.AUTH_SECRET ? "set" : "MISSING",
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || "not set",
      AUTH_URL: process.env.AUTH_URL || "not set",
    },
  };

  try {
    const userCount = await prisma.user.count();
    const workspaceCount = await prisma.workspace.count();
    checks.database = {
      status: "connected",
      users: userCount,
      workspaces: workspaceCount,
    };
  } catch (err) {
    checks.database = {
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const ok = (checks.database as Record<string, unknown>).status === "connected";
  return NextResponse.json(checks, { status: ok ? 200 : 500 });
}
