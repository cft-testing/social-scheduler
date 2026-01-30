import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuthApi } from "@/lib/auth-guard";
import { schedulePostSchema } from "@/lib/validation";
import { enqueuePublishJob } from "@/jobs/queue";
import { PostStatus } from "@prisma/client";
import { createLogger } from "@/lib/logger";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await requireAuthApi();
  if (error) return error;

  const body = await req.json();
  const parsed = schedulePostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message || "Data inválida" }, { status: 400 });
  }

  const post = await prisma.post.findFirst({
    where: { id, workspaceId: session!.user.workspaceId, statusGlobal: PostStatus.DRAFT },
    include: { postChannels: true },
  });

  if (!post) {
    return NextResponse.json({ error: "Publicação não encontrada ou não é rascunho" }, { status: 404 });
  }

  const scheduledAtUtc = new Date(parsed.data.scheduledAtUtc);
  const delayMs = scheduledAtUtc.getTime() - Date.now();

  await prisma.post.update({
    where: { id },
    data: {
      statusGlobal: PostStatus.SCHEDULED,
      scheduledAtUtc,
      lastEditorId: session!.user.id,
    },
  });

  for (const pc of post.postChannels) {
    await prisma.postChannel.update({
      where: { id: pc.id },
      data: { status: PostStatus.SCHEDULED },
    });
    await enqueuePublishJob(pc.id, delayMs > 0 ? delayMs : 0);
  }

  const logger = createLogger(session!.user.workspaceId, session!.user.id);
  await logger.info("post.scheduled", `Publicação agendada para ${parsed.data.scheduledAtUtc}`, { postId: id });

  return NextResponse.json({ success: true, scheduledAtUtc: parsed.data.scheduledAtUtc });
}
