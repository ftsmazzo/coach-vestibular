"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
    case "alavanca":
      return { text: "Alavanca", tone: "success" };
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
  questsAlavanca?: Quest[];
  planoAtualizadoEm: string | null;
  recoveryMode: boolean;
  provaId?: string | null;
  provaNome?: string | null;
}

export default function QuestsPage() {
  const searchParams = useSearchParams();
  const provaId = searchParams.get("provaId");
  const [data, setData] = useState<QuestsResponse | null>(null);
  const [mood, setMood] = useState(3);
  const [loading, setLoading] = useState(true);
  const [xpToast, setXpToast] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const qs = provaId ? `?provaId=${encodeURIComponent(provaId)}` : "";
    const res = await fetch(`/api/quests${qs}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, [provaId]);

  useEffect(() => {
    load();
  }, [load]);

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
  const alavancas = data?.questsAlavanca ?? [];
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
            : "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
        }
      >
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
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
                  {erros} erro{erros > 1 ? "s" : ""} na jornada
                </Badge>
              )}
            </div>
            {q.descricao && (
              <p
                className={`mt-2 text-sm text-slate-600 ${
                  q.meta?.bloco === "alavanca" ? "whitespace-pre-line leading-relaxed" : ""
                }`}
              >
                {q.descricao}
              </p>
            )}
            <p className="mt-1 text-xs text-slate-500">~{q.duracaoMin} min</p>
          </div>
          <Button onClick={() => completeQuest(q.id)} className="w-full shrink-0 sm:w-auto">
            Concluir
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {data?.provaNome ? "Quests desta prova" : "Quests"}
        </h1>
        <p className="text-slate-600">
          {data?.provaNome
            ? `Micro-plano de ${data.provaNome} — tarefas só desta prova.`
            : "Plano completo: blocos profundos, consolidação, manutenção e integração — na ordem do plano semanal."}
        </p>
        {provaId && (
          <p className="mt-2 text-sm">
            <Link href={`/provas/${provaId}/lente`} className="text-teal-700 hover:underline">
              ← Voltar à lente da prova
            </Link>
            {" · "}
            <Link href="/quests" className="text-slate-600 hover:underline">
              Ver plano global
            </Link>
          </p>
        )}
        {data?.recoveryMode && (
          <p className="mt-1 text-sm text-amber-800">Modo recuperação: menos quests, metas menores.</p>
        )}
      </div>

      <Card>
        <p className="text-sm font-medium">Como você está agora? (ao concluir uma quest)</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setMood(n)}
              className={`flex h-11 w-11 items-center justify-center rounded-full text-base font-medium ${
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

          {alavancas.length > 0 && !provaId && (
            <section id="alavancas">
              <h2 className="mb-1 font-semibold text-teal-900">O que fazer agora (copiloto)</h2>
              <p className="mb-3 text-sm text-slate-500">
                Passo a passo da sua prioridade da jornada. Siga na ordem; ao terminar, marque
                Concluir. Não substitui o plano semanal.
              </p>
              <ul className="space-y-3">
                {alavancas.map((q) => (
                  <li key={q.id}>
                    <QuestCard q={q} destaque />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="mb-1 font-semibold">
              {provaId ? "Tarefas do micro-plano" : "Tarefas da semana"}
            </h2>
            <p className="mb-3 text-sm text-slate-500">
              {provaId ? (
                <>
                  Gere o micro-plano na{" "}
                  <Link href={`/provas/${provaId}/lente`} className="text-teal-700 hover:underline">
                    lente da prova
                  </Link>{" "}
                  se ainda não houver tarefas.
                </>
              ) : (
                <>
                  Ordem do plano: profundo → consolidar → manter → integrar. Ver{" "}
                  <Link href="/plano" className="text-teal-700 hover:underline">
                    Plano
                  </Link>
                  .
                </>
              )}
            </p>
            {pendingPlano.length === 0 ? (
              <p className="text-sm text-slate-500">
                Nenhuma quest{provaId ? " desta prova" : " do plano atual"}.
                {provaId ? (
                  <>
                    {" "}
                    <Link href={`/provas/${provaId}/lente`} className="text-teal-700 underline">
                      Abrir lente da prova
                    </Link>
                  </>
                ) : (
                  <>
                    {" "}
                    <Link href="/simulados" className="text-teal-700 underline">
                      Atualize o diagnóstico
                    </Link>{" "}
                    no seu último registro.
                  </>
                )}
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
