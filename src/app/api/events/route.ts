import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuthApi } from "@/lib/auth-guard";

export async function GET(req: NextRequest) {
  const { session, error } = await requireAuthApi();
  if (error) return error;

  const url = new URL(req.url);
  const postId = url.searchParams.get("postId");
  const channelId = url.searchParams.get("channelId");
  const level = url.searchParams.get("level");
  const page = parseInt(url.searchParams.get("page") || "1");
  const pageSize = Math.min(parseInt(url.searchParams.get("pageSize") || "50"), 100);

  const where: Record<string, unknown> = { workspaceId: session!.user.workspaceId };
  if (postId) where.postId = postId;
  if (channelId) where.channelId = channelId;
  if (level) where.level = level;

  const [events, total] = await Promise.all([
    prisma.eventLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.eventLog.count({ where }),
  ]);

  return NextResponse.json({ events, total, page, pageSize });
}
