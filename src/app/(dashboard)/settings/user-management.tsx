"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface UserItem {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

export function UserManagement({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => setUsers(data.users || []))
      .catch(() => setError("Erro ao carregar utilizadores"))
      .finally(() => setLoading(false));
  }, []);

  async function handleRoleChange(userId: string, newRole: string) {
    setError(null);
    const res = await fetch(`/api/users/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
    } else {
      setError("Erro ao alterar a função do utilizador");
    }
  }

  async function handleDelete(userId: string) {
    if (!confirm("Tem a certeza que pretende eliminar este utilizador?")) return;
    setError(null);
    const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } else {
      setError("Erro ao eliminar utilizador");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestão de Utilizadores</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <p className="mb-3 text-sm text-red-600">{error}</p>
        )}
        {loading ? (
          <p className="text-sm text-gray-500">A carregar...</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum utilizador encontrado</p>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">{user.name || user.email}</p>
                  <p className="text-xs text-gray-400">{user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {user.id === currentUserId ? (
                    <Badge>Você</Badge>
                  ) : (
                    <>
                      <Select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        className="w-28"
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="EDITOR">Editor</option>
                        <option value="VIEWER">Viewer</option>
                      </Select>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(user.id)}
                      >
                        Eliminar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
