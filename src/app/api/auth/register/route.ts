import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { registerSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { Role } from "@prisma/client";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const { allowed } = rateLimit(`register:${ip}`, { windowMs: 60_000, max: 5 });
  if (!allowed) {
    return NextResponse.json({ error: "Demasiados pedidos. Tente novamente mais tarde." }, { status: 429 });
  }

  const body = await req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || "Dados inválidos" },
      { status: 400 }
    );
  }

  const { email, password, name } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email já registado" }, { status: 409 });
  }

  // Get or create default workspace
  let workspace = await prisma.workspace.findFirst();
  if (!workspace) {
    workspace = await prisma.workspace.create({ data: { name: "Workspace Principal" } });
  }

  // First user is admin
  const userCount = await prisma.user.count({ where: { workspaceId: workspace.id } });
  const role = userCount === 0 ? Role.ADMIN : Role.EDITOR;

  const passwordHash = await hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      role,
      workspaceId: workspace.id,
    },
  });

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  }, { status: 201 });
}
