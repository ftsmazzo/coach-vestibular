"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Button, Badge } from "@/components/ui";

interface QuestMeta {
  ordem: number;
  bloco?: string;
  materiaDestaque?: string;
  errosNaMateria?: number;
  geraQuest?: boolean;
}

function labelBloco(bloco?: string): { text: string; tone: "danger" | "warning" | "success" | "neutral" } | null {
  switch (bloco) {
    case "foco_profundo":
      return { text: "Estudo profundo", tone: "danger" };
    case "consolidacao":
      return { text: "Consolidar", tone: "warning" };
    case "manutencao":
      return { text: "Manter", tone: "success" };
    case "integracao":
      return { text: "Integrar", tone: "neutral" };
    default:
      return null;
  }
}

interface Quest {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  duracaoMin: number;
  rewardMsg: string | null;
  ordemPlano: number | null;
  meta: QuestMeta | null;
}

interface QuestsResponse {
  quests: Quest[];
  planoAtualizadoEm: string | null;
  recoveryMode: boolean;
}

export default function QuestsPage() {
  const [data, setData] = useState<QuestsResponse | null>(null);
  const [mood, setMood] = useState(3);
  const [loading, setLoading] = useState(true);
  const [xpToast, setXpToast] = useState("");

  async function load() {
    const res = await fetch("/api/quests");
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function completeQuest(id: string) {
    setXpToast("");
    const res = await fetch("/api/quests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "done", moodAfter: mood }),
    });
    const json = await res.json();
    if (json.xpSemanaGanho > 0 && json.xpSemanaMensagem) {
      setXpToast(json.xpSemanaMensagem);
    }
    load();
  }

  async function pularAntigas() {
    const antigas =
      data?.quests.filter((q) => q.status === "pending" && q.ordemPlano == null) ?? [];
    for (const q of antigas) {
      await fetch("/api/quests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: q.id, status: "skipped" }),
      });
    }
    load();
  }

  const quests = data?.quests ?? [];
  const pending = quests.filter((q) => q.status === "pending");
  const pendingPlano = pending.filter((q) => q.ordemPlano != null);
  const pendingAntigas = pending.filter((q) => q.ordemPlano == null);
  const done = quests.filter((q) => q.status === "done");

  function QuestCard({ q, destaque }: { q: Quest; destaque?: boolean }) {
    const erros = q.meta?.errosNaMateria;
    const blocoLabel = labelBloco(q.meta?.bloco);
    return (
      <Card
        className={
          destaque
            ? "border-teal-200 bg-teal-50/30 ring-1 ring-teal-100"
            : "flex flex-wrap items-center justify-between gap-3"
        }
      >
        <div className="flex flex-wrap items-start justify-between gap-3 w-full">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {q.ordemPlano != null && (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
                  {q.ordemPlano}
                </span>
              )}
              <h3 className="font-semibold text-slate-900">{q.titulo}</h3>
              {blocoLabel && <Badge tone={blocoLabel.tone}>{blocoLabel.text}</Badge>}
              {erros != null && erros > 0 && (
                <Badge tone="danger">
                  {erros} erro{erros > 1 ? "s" : ""} na prova
                </Badge>
              )}
            </div>
            {q.descricao && <p className="mt-2 text-sm text-slate-600">{q.descricao}</p>}
            <p className="mt-1 text-xs text-slate-500">~{q.duracaoMin} min</p>
          </div>
          <Button onClick={() => completeQuest(q.id)}>Concluir</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Quests</h1>
        <p className="text-slate-600">
          Plano completo: blocos profundos, consolidação, manutenção e integração — na ordem do
          plano semanal.
        </p>
        {data?.recoveryMode && (
          <p className="mt-1 text-sm text-amber-800">Modo recuperação: menos quests, metas menores.</p>
        )}
      </div>

      <Card>
        <p className="text-sm font-medium">Como você está agora? (ao concluir uma quest)</p>
        <div className="mt-2 flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setMood(n)}
              className={`h-9 w-9 rounded-full text-sm ${
                mood === n ? "bg-teal-600 text-white" : "bg-slate-100"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </Card>

      {xpToast && (
        <p className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-medium text-violet-900">
          {xpToast}
        </p>
      )}

      {loading ? (
        <p className="text-slate-500">Carregando...</p>
      ) : (
        <>
          {pendingAntigas.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/60">
              <p className="text-sm text-amber-950">
                Há <strong>{pendingAntigas.length}</strong> tarefa(s) de planos antigos (não batem
                com o plano atual).
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={pularAntigas}>
                  Arquivar tarefas antigas
                </Button>
                <Link href="/plano" className="text-sm text-teal-700 hover:underline self-center">
                  Ver plano atual →
                </Link>
              </div>
            </Card>
          )}

          <section>
            <h2 className="mb-1 font-semibold">Tarefas da semana</h2>
            <p className="mb-3 text-sm text-slate-500">
              Ordem do plano: profundo → consolidar → manter → integrar. Ver{" "}
              <Link href="/plano" className="text-teal-700 hover:underline">
                Plano
              </Link>
              .
            </p>
            {pendingPlano.length === 0 ? (
              <p className="text-sm text-slate-500">
                Nenhuma quest do plano atual.{" "}
                <Link href="/simulados" className="text-teal-700 underline">
                  Atualize o diagnóstico
                </Link>{" "}
                no seu último registro.
              </p>
            ) : (
              <ul className="space-y-3">
                {pendingPlano.map((q, i) => (
                  <li key={q.id}>
                    <QuestCard q={q} destaque={i === 0} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {done.length > 0 && (
            <section>
              <h2 className="mb-3 font-semibold">Concluídas</h2>
              <ul className="space-y-3">
                {done.map((q) => (
                  <li key={q.id}>
                    <Card className="bg-emerald-50/50">
                      <div className="flex items-center gap-2">
                        <Badge tone="success">Feita</Badge>
                        <span className="font-medium">{q.titulo}</span>
                      </div>
                      {q.rewardMsg && (
                        <p className="mt-2 text-sm text-emerald-800">{q.rewardMsg}</p>
                      )}
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
