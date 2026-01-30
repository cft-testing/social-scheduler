import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRoleApi } from "@/lib/auth-guard";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await requireRoleApi("ADMIN");
  if (error) return error;

  const channel = await prisma.channel.findFirst({
    where: { id, workspaceId: session!.user.workspaceId },
  });

  if (!channel) {
    return NextResponse.json({ error: "Canal não encontrado" }, { status: 404 });
  }

  await prisma.channel.update({
    where: { id },
    data: { connected: false },
  });

  return NextResponse.json({ success: true });
}
