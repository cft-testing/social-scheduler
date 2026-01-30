import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRoleApi } from "@/lib/auth-guard";

export async function GET() {
  const { session, error } = await requireRoleApi("ADMIN");
  if (error) return error;

  const users = await prisma.user.findMany({
    where: { workspaceId: session!.user.workspaceId },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ users });
}
