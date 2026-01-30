import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuthApi } from "@/lib/auth-guard";
import { cancelPublishJob } from "@/jobs/queue";
import { PostStatus } from "@prisma/client";
import { createLogger } from "@/lib/logger";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await requireAuthApi();
  if (error) return error;

  const post = await prisma.post.findFirst({
    where: { id, workspaceId: session!.user.workspaceId },
    include: {
      author: { select: { name: true, email: true } },
      lastEditor: { select: { name: true, email: true } },
      media: { orderBy: { order: "asc" } },
      postChannels: {
        include: {
          channel: true,
          cancelledBy: { select: { name: true, email: true } },
        },
      },
    },
  });

  if (!post) {
    return NextResponse.json({ error: "Publicação não encontrada" }, { status: 404 });
  }

  return NextResponse.json(post);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await requireAuthApi();
  if (error) return error;

  const post = await prisma.post.findFirst({
    where: { id, workspaceId: session!.user.workspaceId },
    include: { postChannels: true },
  });

  if (!post) {
    return NextResponse.json({ error: "Publicação não encontrada" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const logger = createLogger(session!.user.workspaceId, session!.user.id);

  if (body.postChannelId) {
    // Cancel specific channel
    const pc = post.postChannels.find((p) => p.id === body.postChannelId);
    if (!pc || (pc.status !== PostStatus.SCHEDULED && pc.status !== PostStatus.DRAFT)) {
      return NextResponse.json({ error: "Não é possível cancelar" }, { status: 400 });
    }
    await cancelPublishJob(pc.id);
    await prisma.postChannel.update({
      where: { id: pc.id },
      data: { status: PostStatus.CANCELLED, cancelledById: session!.user.id },
    });
    await logger.info("postChannel.cancelled", `Canal cancelado`, { postId: id, channelId: pc.channelId });
  } else {
    // Cancel all cancellable channels
    for (const pc of post.postChannels) {
      if (pc.status === PostStatus.SCHEDULED || pc.status === PostStatus.DRAFT) {
        await cancelPublishJob(pc.id);
        await prisma.postChannel.update({
          where: { id: pc.id },
          data: { status: PostStatus.CANCELLED, cancelledById: session!.user.id },
        });
      }
    }
    await logger.info("post.cancelled", `Publicação cancelada`, { postId: id });
  }

  // Update global status
  const updatedChannels = await prisma.postChannel.findMany({
    where: { postId: id },
    select: { status: true },
  });
  const statuses = updatedChannels.map((c) => c.status);
  let globalStatus: PostStatus;
  if (statuses.every((s) => s === PostStatus.CANCELLED)) globalStatus = PostStatus.CANCELLED;
  else if (statuses.some((s) => s === PostStatus.PUBLISHED)) globalStatus = PostStatus.PUBLISHED;
  else if (statuses.some((s) => s === PostStatus.FAILED)) globalStatus = PostStatus.FAILED;
  else if (statuses.some((s) => s === PostStatus.SCHEDULED)) globalStatus = PostStatus.SCHEDULED;
  else globalStatus = PostStatus.DRAFT;

  await prisma.post.update({
    where: { id },
    data: { statusGlobal: globalStatus },
  });

  return NextResponse.json({ success: true });
}
