import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRoleApi } from "@/lib/auth-guard";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await requireRoleApi("ADMIN");
  if (error) return error;

  if (id === session!.user.id) {
    return NextResponse.json({ error: "Não pode eliminar a sua própria conta" }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { id, workspaceId: session!.user.workspaceId },
  });

  if (!user) {
    return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });
  }

  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
