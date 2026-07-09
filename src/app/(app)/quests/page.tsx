"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, Button, Badge } from "@/components/ui";
import { CicloHeader } from "@/components/ciclo-header";
import type { CicloResumo } from "@/lib/ciclo";

interface QuestMeta {
  ordem?: number;
  bloco?: string;
  rotulo?: string;
  materiaDestaque?: string;
  errosNaMateria?: number;
  criterioConclusao?: string;
  motivo?: string;
}

const TIPO_QUEST_LABEL: Record<string, string> = {
  REVISAO_ERRO: "Revisão de erro",
  CONCEITO_BASE: "Conceito base",
  TREINO_GUIADO: "Treino guiado",
  METACOGNICAO: "Metacognição",
};

interface Quest {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  duracaoMin: number;
  rewardMsg: string | null;
  ordemPlano: number | null;
  dueDate?: string | null;
  meta: QuestMeta | null;
}

interface QuestsResponse {
  quests: Quest[];
  oQueFazerAgora?: Quest[];
  copilotoConcluidas?: Quest[];
  fluxoJornadaNovo?: boolean;
  ciclo?: CicloResumo | null;
  planoAtualizadoEm: string | null;
  recoveryMode: boolean;
  provaId?: string | null;
  conjuntoId?: string | null;
  provaNome?: string | null;
  lenteHref?: string | null;
}

function diaSugeridoLabel(dueDate?: string | null): string | null {
  if (!dueDate) return null;
  const d = new Date(dueDate);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

function QuestsPageInner() {
  const searchParams = useSearchParams();
  const provaId = searchParams.get("provaId");
  const conjuntoId = searchParams.get("conjuntoId");
  const escopoProva = Boolean(provaId || conjuntoId);
  const [data, setData] = useState<QuestsResponse | null>(null);
  const [mood, setMood] = useState(3);
  const [loading, setLoading] = useState(true);
  const [xpToast, setXpToast] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (conjuntoId) params.set("conjuntoId", conjuntoId);
    else if (provaId) params.set("provaId", provaId);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`/api/quests${qs}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, [provaId, conjuntoId]);

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

  const oQueFazer = data?.oQueFazerAgora ?? [];
  const outras = data?.quests ?? [];
  const pendingOutras = outras.filter((q) => q.status === "pending");
  const done = [
    ...(data?.copilotoConcluidas ?? []),
    ...outras.filter((q) => q.status === "done"),
  ];

  const fluxoJornada = data?.fluxoJornadaNovo ?? false;
  const lenteHref =
    data?.lenteHref ??
    (conjuntoId
      ? `/provas/conjunto/${conjuntoId}/lente`
      : provaId
        ? `/provas/${provaId}/lente`
        : null);

  function QuestCard({
    q,
    destaque,
    numero,
  }: {
    q: Quest;
    destaque?: boolean;
    numero?: number;
  }) {
    const rotulo = q.meta?.rotulo;
    const tipoLabel = rotulo ? TIPO_QUEST_LABEL[rotulo] ?? rotulo : null;
    const dia = diaSugeridoLabel(q.dueDate);
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
              {numero != null && (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
                  {numero}
                </span>
              )}
              <h3 className="font-semibold text-slate-900">{q.titulo}</h3>
              {rotulo && fluxoJornada && tipoLabel && (
                <Badge tone="neutral">{tipoLabel}</Badge>
              )}
              {rotulo && !fluxoJornada && <Badge tone="success">{rotulo}</Badge>}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              ~{q.duracaoMin} min
              {dia ? ` · sugerido: ${dia}` : ""}
            </p>
            {q.descricao && (
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">
                {q.descricao}
              </p>
            )}
            {q.meta?.motivo && (
              <p className="mt-2 text-xs text-slate-600">
                <span className="font-medium">Por que existe:</span> {q.meta.motivo}
              </p>
            )}
            {q.meta?.criterioConclusao && (
              <p className="mt-1 text-xs text-teal-800">
                <span className="font-medium">Concluir quando:</span> {q.meta.criterioConclusao}
              </p>
            )}
            {fluxoJornada && (
              <p className="mt-2 text-xs text-amber-800">
                Concluir esta quest registra adesão local — não confirma domínio global do escopo.
              </p>
            )}
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
            : fluxoJornada
              ? "Quests da Semana 1 da Jornada — específicas ao foco do ciclo ativo. O plano em /plano explica o porquê."
              : "Comece por O que fazer agora — passos da sua jornada inteira. O plano em /plano explica o porquê."}
        </p>
        {escopoProva && lenteHref && (
          <p className="mt-2 text-sm">
            <Link href={lenteHref} className="text-teal-700 hover:underline">
              ← Voltar à lente da prova
            </Link>
            {" · "}
            <Link href="/quests" className="text-slate-600 hover:underline">
              Ver jornada
            </Link>
          </p>
        )}
        {data?.recoveryMode && (
          <p className="mt-1 text-sm text-amber-800">Modo recuperação: menos tarefas, metas menores.</p>
        )}
      </div>

      {!escopoProva && data?.ciclo && (
        <CicloHeader ciclo={data.ciclo} fluxoJornadaV1={fluxoJornada} />
      )}

      <Card>
        <p className="text-sm font-medium">Como você está agora? (ao concluir uma tarefa)</p>
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
          {pendingOutras.length > 0 && !escopoProva && !fluxoJornada && (
            <Card className="border-amber-200 bg-amber-50/60">
              <p className="text-sm text-amber-950">
                Há <strong>{pendingOutras.length}</strong> tarefa(s) de planos antigos (duplicam o
                copiloto).
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={pularAntigas}>
                  Arquivar tarefas antigas
                </Button>
                <Link href="/plano" className="self-center text-sm text-teal-700 hover:underline">
                  Ver plano →
                </Link>
              </div>
            </Card>
          )}

          {!escopoProva && (
            <section id={fluxoJornada ? "jornada" : "agora"}>
              <h2 className="mb-1 text-lg font-semibold text-teal-900">
                {fluxoJornada ? "Quests da Semana 1" : "O que fazer agora"}
              </h2>
              <p className="mb-3 text-sm text-slate-500">
                {fluxoJornada
                  ? "Tarefas do motor da Jornada — uma por vez, na ordem. Não misturamos com quests de prova ou copiloto legado."
                  : "Sua lista da semana — uma tarefa de cada vez, na ordem. Baseada em todos os registros da jornada, não só na última prova."}
              </p>
              {oQueFazer.length === 0 ? (
                <Card className="border-dashed border-slate-200">
                  <p className="text-sm text-slate-600">
                    Nenhuma tarefa ainda. Abra a{" "}
                    <Link href="/dashboard" className="text-teal-700 underline">
                      Home
                    </Link>{" "}
                    ou atualize o plano em{" "}
                    <Link href="/plano" className="text-teal-700 underline">
                      Plano
                    </Link>
                    .
                  </p>
                </Card>
              ) : (
                <ul className="space-y-3">
                  {oQueFazer.map((q, i) => (
                    <li key={q.id}>
                      <QuestCard q={q} destaque={i === 0} numero={i + 1} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {escopoProva && pendingOutras.length > 0 && (
            <section>
              <h2 className="mb-3 font-semibold">Tarefas desta prova</h2>
              <ul className="space-y-3">
                {pendingOutras.map((q, i) => (
                  <li key={q.id}>
                    <QuestCard q={q} destaque={i === 0} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {escopoProva && pendingOutras.length === 0 && done.length === 0 && (
            <Card className="border-dashed border-slate-200">
              <p className="text-sm text-slate-600">
                Nenhuma quest desta prova ainda.{" "}
                {lenteHref && (
                  <>
                    Gere o micro-plano na{" "}
                    <Link href={lenteHref} className="font-medium text-teal-700 underline">
                      lente da prova
                    </Link>
                    .
                  </>
                )}
              </p>
            </Card>
          )}
        </>
      )}

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
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function QuestsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-slate-500">Carregando quests…</p>}>
      <QuestsPageInner />
    </Suspense>
  );
}
