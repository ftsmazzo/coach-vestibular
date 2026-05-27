"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button, Card, Input, Label } from "@/components/ui";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const conviteUrl = searchParams.get("convite") ?? searchParams.get("code") ?? "";

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    inviteCode: "",
    vestibularAlvo: "Medicina",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (conviteUrl) {
      setForm((f) => ({ ...f, inviteCode: conviteUrl.trim().toUpperCase() }));
    }
  }, [conviteUrl]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        inviteCode: form.inviteCode.trim().toUpperCase(),
        email: form.email.trim().toLowerCase(),
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Erro ao criar conta");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-teal-50 to-slate-50 p-4">
      <Card className="w-full max-w-md">
        <h1 className="mb-1 text-2xl font-bold text-slate-900">Criar sua conta</h1>
        <p className="mb-6 text-sm text-slate-600">
          Acesso com convite. Use o código que você recebeu da equipe Coach Vestibular.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nome completo</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div>
            <Label>Senha (mín. 6 caracteres)</Label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
            />
          </div>
          <div>
            <Label>Código de convite</Label>
            <Input
              value={form.inviteCode}
              onChange={(e) =>
                setForm({ ...form, inviteCode: e.target.value.toUpperCase() })
              }
              placeholder="COACH-2026-XXXXX"
              className="font-mono"
              required
            />
          </div>
          <div>
            <Label>Vestibular alvo</Label>
            <Input
              value={form.vestibularAlvo}
              onChange={(e) => setForm({ ...form, vestibularAlvo: e.target.value })}
            />
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Criando conta..." : "Criar conta e entrar"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600">
          Já tem conta?{" "}
          <Link href="/login" className="font-medium text-teal-700 hover:underline">
            Entrar
          </Link>
        </p>
      </Card>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-slate-500">
          Carregando...
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
