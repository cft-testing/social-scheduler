"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Check DB connectivity first
      const health = await fetch("/api/health").catch(() => null);
      if (!health || !health.ok) {
        const data = await health?.json().catch(() => ({}));
        setError("Erro de ligação à base de dados. Verifique as configurações do servidor.");
        console.error("Health check failed:", data);
        return;
      }

      const formData = new FormData(e.currentTarget);
      const result = await signIn("credentials", {
        email: formData.get("email") as string,
        password: formData.get("password") as string,
        redirect: false,
      });

      if (result?.error) {
        setError("Email ou password incorretos");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError("Erro de rede. Verifique a sua conexão.");
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Social Scheduler</CardTitle>
        <CardDescription>Inicie sessão na sua conta</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required placeholder="email@exemplo.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required placeholder="••••••" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "A entrar..." : "Entrar"}
          </Button>
          <p className="text-center text-sm text-gray-500">
            Não tem conta?{" "}
            <Link href="/register" className="text-blue-600 hover:underline">
              Registar
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
