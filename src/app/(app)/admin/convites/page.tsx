"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Button, Input, Label, Badge } from "@/components/ui";

interface Invite {
  id: string;
  code: string;
  maxUses: number;
  usedCount: number;
  active: boolean;
  createdAt: string;
}

function linkCadastro(code: string) {
  if (typeof window === "undefined") return `/register?convite=${code}`;
  return `${window.location.origin}/register?convite=${encodeURIComponent(code)}`;
}

export default function ConvitesPage() {
  const router = useRouter();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [code, setCode] = useState("");
  const [maxUses, setMaxUses] = useState(10);
  const [error, setError] = useState("");
  const [copiado, setCopiado] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/invites");
    if (res.status === 403) {
      router.push("/admin");
      return;
    }
    if (res.ok) setInvites(await res.json());
  }

  useEffect(() => {
    load();
  }, [router]);

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code || undefined, maxUses }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Erro ao criar convite");
      return;
    }
    setCode("");
    load();
  }

  async function toggleAtivo(inv: Invite) {
    await fetch(`/api/invites/${inv.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !inv.active }),
    });
    load();
  }

  async function copiar(texto: string, id: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(id);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      setError("Não foi possível copiar — selecione o texto manualmente.");
    }
  }

  const esgotado = (inv: Invite) => inv.usedCount >= inv.maxUses;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-sm text-teal-700 hover:underline">
          ← Painel admin
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Convites de acesso</h1>
        <p className="mt-1 text-slate-600">
          Para quem vai se cadastrar sozinho. Prefere criar a conta você? Use{" "}
          <Link href="/admin/usuarios" className="font-medium text-teal-700 hover:underline">
            Alunos e acesso
          </Link>
          .
        </p>
      </div>

      <Card>
        <h2 className="font-semibold text-slate-900">Gerar novo convite</h2>
        <form onSubmit={createInvite} className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <Label>Código (opcional)</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="COACH-2026-ALUNO1"
              className="font-mono"
            />
          </div>
          <div>
            <Label>Máx. cadastros</Label>
            <Input
              type="number"
              min={1}
              value={maxUses}
              onChange={(e) => setMaxUses(parseInt(e.target.value, 10) || 1)}
            />
          </div>
          <Button type="submit">Gerar convite</Button>
        </form>
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      </Card>

      <ul className="space-y-3">
        {invites.length === 0 && (
          <Card>
            <p className="text-sm text-slate-600">
              Nenhum convite ainda. Gere um código ou crie alunos diretamente em Alunos e acesso.
            </p>
          </Card>
        )}
        {invites.map((inv) => {
          const url = linkCadastro(inv.code);
          const disponivel = inv.active && !esgotado(inv);
          return (
            <li key={inv.id}>
              <Card className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-lg font-semibold text-slate-900">
                    {inv.code}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {disponivel ? (
                      <Badge tone="success">Disponível</Badge>
                    ) : !inv.active ? (
                      <Badge tone="neutral">Inativo</Badge>
                    ) : (
                      <Badge tone="warning">Esgotado</Badge>
                    )}
                    <span className="text-sm text-slate-600">
                      {inv.usedCount}/{inv.maxUses} usos
                    </span>
                  </div>
                </div>
                <p className="break-all text-xs text-slate-500">{url}</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="text-xs"
                    onClick={() => copiar(inv.code, `code-${inv.id}`)}
                  >
                    {copiado === `code-${inv.id}` ? "Código copiado" : "Copiar código"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="text-xs"
                    onClick={() => copiar(url, `url-${inv.id}`)}
                  >
                    {copiado === `url-${inv.id}` ? "Link copiado" : "Copiar link de cadastro"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-xs"
                    onClick={() => toggleAtivo(inv)}
                  >
                    {inv.active ? "Desativar" : "Reativar"}
                  </Button>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
