import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserManagement } from "./user-management";

export default async function SettingsPage() {
  const session = await auth();
  const isAdmin = session!.user.role === "ADMIN";

  const workspace = await prisma.workspace.findUnique({
    where: { id: session!.user.workspaceId },
  });

  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">Definições</h1>

      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-gray-500">Nome:</span> {workspace?.name}
          </p>
          <p>
            <span className="text-gray-500">ID:</span>{" "}
            <code className="rounded bg-gray-100 px-1">{workspace?.id}</code>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>A Minha Conta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-gray-500">Nome:</span> {user?.name || "—"}
          </p>
          <p>
            <span className="text-gray-500">Email:</span> {user?.email}
          </p>
          <p>
            <span className="text-gray-500">Função:</span> {user?.role}
          </p>
        </CardContent>
      </Card>

      {isAdmin && <UserManagement currentUserId={session!.user.id} />}
    </div>
  );
}
