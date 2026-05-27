"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Badge } from "@/components/ui";
import { XP_SUGESTAO_ACEITA } from "@/lib/xp-valores";

type Sugestao = {
  id: string;
  numero: number;
  status: "PENDENTE" | "ACEITA" | "REJEITADA";
  texto: string;
  materiaAtual: string;
  assuntoAtual: string;
  areaBlocoAtual: string | null;
  materiaSugerida: string | null;
  assuntoSugerido: string | null;
  areaBlocoSugerida: string | null;
  xpConcedido: number;
  respostaAdmin: string | null;
  createdAt: string;
  reviewedAt: string | null;
  user: { id: string; name: string; email: string; xp: number };
  exam: { id: string; nome: string; provaId: string | null };
};

export function AdminSugestoesLista() {
  const [lista, setLista] = useState<Sugestao[]>([]);
  const [loading, setLoading] = useState(true);
  const [acaoId, setAcaoId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/sugestoes-classificacao");
    const data = await res.json();
    setLoading(false);
    if (Array.isArray(data)) setLista(data);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function revisar(
    id: string,
    acao: "aceitar" | "rejeitar",
    aplicarNaQuestao = true
  ) {
    setAcaoId(id);
    setMsg("");
    const res = await fetch(`/api/admin/sugestoes-classificacao/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao, aplicarNaQuestao }),
    });
    const data = await res.json();
    setAcaoId(null);
    if (!res.ok) {
      setMsg(data.error ?? "Erro");
      return;
    }
    setMsg(data.mensagem ?? "Atualizado");
    await carregar();
  }

  const pendentes = lista.filter((s) => s.status === "PENDENTE");
  const outras = lista.filter((s) => s.status !== "PENDENTE");

  if (loading) {
    return <p className="text-sm text-slate-500">Carregando sugestões...</p>;
  }

  return (
    <div className="space-y-6">
      {msg && (
        <p className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800">{msg}</p>
      )}

      <p className="text-sm text-slate-600">
        Alunos sinalizam matéria/assunto incorretos. Ao aceitar, o aluno ganha{" "}
        <strong>{XP_SUGESTAO_ACEITA} XP</strong> (ranking em breve). Você pode aplicar a
        correção no banco da questão.
      </p>

      {pendentes.length === 0 ? (
        <Card>
          <p className="text-slate-600">Nenhuma sugestão pendente no momento.</p>
        </Card>
      ) : (
        <ul className="space-y-4">
          {pendentes.map((s) => (
            <Card key={s.id} className="border-violet-200">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Badge tone="warning">Pendente</Badge>
                  <p className="mt-2 font-medium text-slate-900">
                    Q{s.numero} — {s.exam.nome}
                  </p>
                  <p className="text-xs text-slate-500">
                    {s.user.name} ({s.user.email}) · {s.user.xp} XP
                  </p>
                </div>
                <Link
                  href={`/simulados/${s.exam.id}`}
                  className="text-sm text-teal-700 hover:underline"
                >
                  Ver registro →
                </Link>
              </div>

              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div className="rounded-lg bg-slate-50 p-2">
                  <p className="text-xs font-medium text-slate-500">Atual</p>
                  <p>
                    {s.materiaAtual} / {s.assuntoAtual}
                  </p>
                  {s.areaBlocoAtual && (
                    <p className="text-xs text-slate-500">{s.areaBlocoAtual}</p>
                  )}
                </div>
                {(s.materiaSugerida || s.assuntoSugerido || s.areaBlocoSugerida) && (
                  <div className="rounded-lg bg-violet-50 p-2">
                    <p className="text-xs font-medium text-violet-700">Sugerido</p>
                    <p>
                      {s.materiaSugerida ?? "—"} / {s.assuntoSugerido ?? "—"}
                    </p>
                    {s.areaBlocoSugerida && (
                      <p className="text-xs text-violet-600">{s.areaBlocoSugerida}</p>
                    )}
                  </div>
                )}
              </div>

              <p className="mt-3 text-sm text-slate-700 whitespace-pre-wrap">{s.texto}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={acaoId === s.id}
                  onClick={() => revisar(s.id, "aceitar", true)}
                >
                  {acaoId === s.id ? "..." : "Aceitar e aplicar no banco"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={acaoId === s.id}
                  onClick={() => revisar(s.id, "aceitar", false)}
                >
                  Aceitar sem alterar banco
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={acaoId === s.id}
                  onClick={() => revisar(s.id, "rejeitar")}
                >
                  Rejeitar
                </Button>
              </div>
            </Card>
          ))}
        </ul>
      )}

      {outras.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Histórico recente</h2>
          <ul className="space-y-2 text-sm">
            {outras.slice(0, 20).map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
              >
                <span>
                  Q{s.numero} · {s.user.name} ·{" "}
                  <Badge tone={s.status === "ACEITA" ? "success" : "neutral"}>
                    {s.status === "ACEITA"
                      ? `Aceita (+${s.xpConcedido} XP)`
                      : "Rejeitada"}
                  </Badge>
                </span>
                <span className="text-xs text-slate-500">
                  {new Date(s.createdAt).toLocaleDateString("pt-BR")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
