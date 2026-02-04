"use client";

import { useActionState } from "react";
import Link from "next/link";
import { authenticate } from "./actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [error, formAction, isPending] = useActionState(authenticate, undefined);

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Social Scheduler</CardTitle>
        <CardDescription>Inicie sessão na sua conta</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
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
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "A entrar..." : "Entrar"}
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
