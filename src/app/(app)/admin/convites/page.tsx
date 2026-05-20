"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Input, Label } from "@/components/ui";

interface Invite {
  id: string;
  code: string;
  maxUses: number;
  usedCount: number;
  active: boolean;
}

export default function ConvitesPage() {
  const router = useRouter();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [code, setCode] = useState("");
  const [maxUses, setMaxUses] = useState(5);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/invites");
    if (res.status === 403) {
      router.push("/admin");
      return;
    }
    setInvites(await res.json());
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
    if (!res.ok) {
      setError("Erro ao criar convite");
      return;
    }
    setCode("");
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Convites — Beta fechado</h1>

      <Card>
        <form onSubmit={createInvite} className="flex flex-wrap items-end gap-4">
          <div>
            <Label>Código (opcional)</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="MED2026-BETA"
            />
          </div>
          <div>
            <Label>Máx. usos</Label>
            <Input
              type="number"
              value={maxUses}
              onChange={(e) => setMaxUses(parseInt(e.target.value, 10))}
            />
          </div>
          <Button type="submit">Gerar convite</Button>
        </form>
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      </Card>

      <ul className="space-y-2">
        {invites.map((inv) => (
          <li key={inv.id}>
            <Card className="flex justify-between">
              <span className="font-mono font-semibold">{inv.code}</span>
              <span className="text-sm text-slate-600">
                {inv.usedCount}/{inv.maxUses} usos · {inv.active ? "Ativo" : "Inativo"}
              </span>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
