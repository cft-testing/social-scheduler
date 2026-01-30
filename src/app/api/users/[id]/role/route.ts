import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRoleApi } from "@/lib/auth-guard";
import { Role } from "@prisma/client";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await requireRoleApi("ADMIN");
  if (error) return error;

  if (id === session!.user.id) {
    return NextResponse.json({ error: "Não pode alterar a sua própria função" }, { status: 400 });
  }

  const body = await req.json();
  const { role } = body;

  if (!role || !Object.values(Role).includes(role)) {
    return NextResponse.json({ error: "Função inválida" }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { id, workspaceId: session!.user.workspaceId },
  });

  if (!user) {
    return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { role },
    select: { id: true, email: true, name: true, role: true },
  });

  return NextResponse.json(updated);
}
