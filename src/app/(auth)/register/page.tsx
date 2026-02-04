"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password"),
          name: formData.get("name"),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Erro ao registar (${res.status})`);
        return;
      }

      router.push("/login");
    } catch (err) {
      setError("Erro de rede. Verifique a sua conexão.");
      console.error("Register error:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Criar Conta</CardTitle>
        <CardDescription>Registe-se para começar a agendar publicações</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" name="name" required placeholder="O seu nome" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required placeholder="email@exemplo.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required minLength={6} placeholder="Mínimo 6 caracteres" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "A registar..." : "Registar"}
          </Button>
          <p className="text-center text-sm text-gray-500">
            Já tem conta?{" "}
            <Link href="/login" className="text-blue-600 hover:underline">
              Iniciar sessão
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
