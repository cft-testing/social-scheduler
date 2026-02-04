import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuthApi } from "@/lib/auth-guard";
import { createPostSchema } from "@/lib/validation";
import { enqueuePublishJob } from "@/jobs/queue";
import { PostStatus } from "@prisma/client";
import { createLogger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const { session, error } = await requireAuthApi();
  if (error) return error;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const page = parseInt(url.searchParams.get("page") || "1");
  const pageSize = Math.min(parseInt(url.searchParams.get("pageSize") || "20"), 100);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const where: Record<string, unknown> = { workspaceId: session!.user.workspaceId };
  if (status) where.statusGlobal = status;
  if (from || to) {
    where.scheduledAtUtc = {};
    if (from) (where.scheduledAtUtc as Record<string, unknown>).gte = new Date(from);
    if (to) (where.scheduledAtUtc as Record<string, unknown>).lte = new Date(to);
  }

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        author: { select: { name: true, email: true } },
        postChannels: { include: { channel: { select: { name: true, type: true } } } },
      },
    }),
    prisma.post.count({ where }),
  ]);

  return NextResponse.json({ posts, total, page, pageSize });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuthApi();
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const parsed = createPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || "Dados inválidos" },
      { status: 400 }
    );
  }

  const { text, channelIds, scheduledAtUtc, mediaIds } = parsed.data;

  // Validate channels belong to workspace
  const channels = await prisma.channel.findMany({
    where: {
      id: { in: channelIds },
      workspaceId: session!.user.workspaceId,
      connected: true,
    },
  });

  if (channels.length !== channelIds.length) {
    return NextResponse.json({ error: "Um ou mais canais são inválidos" }, { status: 400 });
  }

  const logger = createLogger(session!.user.workspaceId, session!.user.id);

  const post = await prisma.post.create({
    data: {
      workspaceId: session!.user.workspaceId,
      authorId: session!.user.id,
      text,
      statusGlobal: scheduledAtUtc ? PostStatus.SCHEDULED : PostStatus.DRAFT,
      scheduledAtUtc: scheduledAtUtc ? new Date(scheduledAtUtc) : null,
      postChannels: {
        create: channelIds.map((channelId) => ({
          channelId,
          status: scheduledAtUtc ? PostStatus.SCHEDULED : PostStatus.DRAFT,
        })),
      },
      ...(mediaIds && mediaIds.length > 0
        ? {
            media: {
              connect: mediaIds.map((id) => ({ id })),
            },
          }
        : {}),
    },
    include: {
      postChannels: true,
    },
  });

  await logger.info("post.created", `Publicação criada: "${text.slice(0, 50)}..."`, { postId: post.id });

  // If scheduled, enqueue jobs
  if (scheduledAtUtc) {
    const delayMs = new Date(scheduledAtUtc).getTime() - Date.now();
    for (const pc of post.postChannels) {
      await enqueuePublishJob(pc.id, delayMs > 0 ? delayMs : 0);
    }
    await logger.info("post.scheduled", `Publicação agendada para ${scheduledAtUtc}`, { postId: post.id });
  }

  return NextResponse.json(post, { status: 201 });
}
