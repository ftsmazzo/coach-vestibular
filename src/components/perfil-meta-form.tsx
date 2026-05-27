"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Label } from "@/components/ui";

export function PerfilMetaForm({
  vestibularAlvoInicial,
  metaProvaInicial,
}: {
  vestibularAlvoInicial: string;
  metaProvaInicial: string;
}) {
  const router = useRouter();
  const [vestibularAlvo, setVestibularAlvo] = useState(vestibularAlvoInicial);
  const [metaProva, setMetaProva] = useState(metaProvaInicial);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro("");
    setMsg("");
    const res = await fetch("/api/me/perfil", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vestibularAlvo, metaProva }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setErro(data.error ?? "Erro ao salvar");
      return;
    }
    setMsg("Meta atualizada — o plano passa a priorizar a banca alinhada nos próximos registros.");
    router.refresh();
  }

  return (
    <Card>
      <form onSubmit={salvar} className="space-y-4">
        <div>
          <Label>Curso / vestibular alvo</Label>
          <Input
            value={vestibularAlvo}
            onChange={(e) => setVestibularAlvo(e.target.value)}
            placeholder="Ex.: Medicina"
          />
        </div>
        <div>
          <Label>Prova ou banca meta</Label>
          <Input
            value={metaProva}
            onChange={(e) => setMetaProva(e.target.value)}
            placeholder="Ex.: ENEM 2026, UFU, UNICAMP"
          />
          <p className="mt-1 text-xs text-slate-500">
            Erros em provas dessa banca pesam um pouco mais na jornada e no panorama do plano.
          </p>
        </div>
        {erro && <p className="text-sm text-rose-600">{erro}</p>}
        {msg && <p className="text-sm text-teal-700">{msg}</p>}
        <Button type="submit" disabled={loading}>
          {loading ? "Salvando..." : "Salvar meta"}
        </Button>
      </form>
    </Card>
  );
}
