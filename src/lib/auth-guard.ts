import { auth } from "./auth";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

const ROLE_HIERARCHY: Record<string, number> = {
  ADMIN: 3,
  EDITOR: 2,
  VIEWER: 1,
};

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}

export async function requireRole(minRole: "ADMIN" | "EDITOR" | "VIEWER") {
  const session = await requireAuth();
  const userLevel = ROLE_HIERARCHY[session.user.role] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[minRole] ?? 0;
  if (userLevel < requiredLevel) {
    redirect("/dashboard");
  }
  return session;
}

export async function requireAuthApi() {
  const session = await auth();
  if (!session?.user) {
    return { session: null, error: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) };
  }
  return { session, error: null };
}

export async function requireRoleApi(minRole: "ADMIN" | "EDITOR" | "VIEWER") {
  const { session, error } = await requireAuthApi();
  if (error) return { session: null, error };
  const userLevel = ROLE_HIERARCHY[session!.user.role] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[minRole] ?? 0;
  if (userLevel < requiredLevel) {
    return {
      session: null,
      error: NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 }),
    };
  }
  return { session, error: null };
}
