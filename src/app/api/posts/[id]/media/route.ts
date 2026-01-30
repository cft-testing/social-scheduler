import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuthApi } from "@/lib/auth-guard";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await requireAuthApi();
  if (error) return error;

  const post = await prisma.post.findFirst({
    where: { id, workspaceId: session!.user.workspaceId },
  });

  if (!post) {
    return NextResponse.json({ error: "Publicação não encontrada" }, { status: 404 });
  }

  const body = await req.json();
  const { url, filename, mimeType, sizeBytes } = body;

  if (!url) {
    return NextResponse.json({ error: "URL é obrigatório" }, { status: 400 });
  }

  const mediaCount = await prisma.postMedia.count({ where: { postId: id } });

  const media = await prisma.postMedia.create({
    data: {
      postId: id,
      url,
      filename,
      mimeType,
      sizeBytes,
      order: mediaCount,
    },
  });

  return NextResponse.json(media, { status: 201 });
}
