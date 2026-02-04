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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const role = body.role as string | undefined;

  if (!role || !Object.values(Role).includes(role as Role)) {
    return NextResponse.json({ error: "Função inválida" }, { status: 400 });
  }

  const validRole = role as Role;

  const user = await prisma.user.findFirst({
    where: { id, workspaceId: session!.user.workspaceId },
  });

  if (!user) {
    return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { role: validRole },
    select: { id: true, email: true, name: true, role: true },
  });

  return NextResponse.json(updated);
}
