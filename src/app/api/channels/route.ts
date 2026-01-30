import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuthApi } from "@/lib/auth-guard";

export async function GET() {
  const { session, error } = await requireAuthApi();
  if (error) return error;

  const channels = await prisma.channel.findMany({
    where: { workspaceId: session!.user.workspaceId },
    select: {
      id: true,
      name: true,
      type: true,
      provider: true,
      externalId: true,
      connected: true,
      needsReconnect: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ channels });
}
