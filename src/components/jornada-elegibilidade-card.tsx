"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import type { ElegibilidadeJornada } from "@/lib/jornada-elegibilidade";
import {
  MIN_ERROS_ANALISAVEIS_JORNADA,
  MIN_PROVAS_JORNADA,
  MIN_QUESTOES_JORNADA,
} from "@/lib/jornada-elegibilidade";
import { Button, Card, LinkButton } from "@/components/ui";

type Props = {
  elegibilidade: ElegibilidadeJornada;
  jornadaIniciada: boolean;
  temRegistrosProva: boolean;
  aguardandoDiagnostico?: boolean;
};

function ItemProgresso({
  ok,
  label,
  atual,
  meta,
}: {
  ok: boolean;
  label: string;
  atual: string;
  meta: string;
}) {
  return (
    <li className="flex items-start gap-3 rounded-lg border border-slate-100 bg-white/80 px-3 py-2.5">
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          ok ? "bg-teal-100 text-teal-800" : "bg-slate-100 text-slate-500"
        }`}
        aria-hidden
      >
        {ok ? "✓" : "·"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="text-xs text-slate-500">
          {atual} · meta: {meta}
        </p>
      </div>
    </li>
  );
}

export function JornadaElegibilidadeCard({
  elegibilidade,
  jornadaIniciada,
  temRegistrosProva,
  aguardandoDiagnostico = false,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { metricas, elegivel, motivosBloqueio } = elegibilidade;
  const pctN1 = Math.round(metricas.pctQuestoesComN1N2N3 * 100);

  async function iniciarJornada() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/jornada/iniciar", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Não foi possível iniciar a Jornada.");
        return;
      }
      router.refresh();
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (jornadaIniciada && aguardandoDiagnostico) {
    return (
      <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 sm:p-6">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">
          Jornada iniciada
        </p>
        <h2 className="mt-1 text-xl font-bold text-slate-900">Preparando Diagnóstico Inicial</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-700">
          Sua Jornada foi iniciada, mas o Diagnóstico Inicial ainda está sendo preparado. Tente
          atualizar a página em instantes ou registre novamente se o problema persistir.
        </p>
        <LinkButton href="/provas" className="mt-4" variant="secondary">
          Ver relatórios de prova
        </LinkButton>
      </Card>
    );
  }

  return (
    <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50/80 via-white to-teal-50/30 p-5 sm:p-6">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-800">
        Antes da Jornada
      </p>
      <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">
        {temRegistrosProva ? "Evidência em construção" : "Sua jornada começa com evidências"}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-slate-700">
        {temRegistrosProva
          ? "Esta prova trouxe sinais importantes, mas ainda não há evidência suficiente para abrir sua Jornada longitudinal. Insira mais provas ou simulados para que o diagnóstico inicial considere padrões recorrentes, não apenas um desempenho isolado."
          : "Registre provas ou simulados do catálogo. Cada uma gera relatório próprio; a Jornada longitudinal só abre quando houver critérios mínimos de evidência."}
      </p>

      <ul className="mt-5 space-y-2">
        <ItemProgresso
          ok={metricas.anamneseConcluida}
          label="Anamnese concluída"
          atual={metricas.anamneseConcluida ? "Concluída" : "Pendente"}
          meta="obrigatória"
        />
        <ItemProgresso
          ok={metricas.provasOuSimuladosValidos >= MIN_PROVAS_JORNADA}
          label="Provas ou simulados válidos"
          atual={`${metricas.provasOuSimuladosValidos}`}
          meta={`≥ ${MIN_PROVAS_JORNADA}`}
        />
        <ItemProgresso
          ok={metricas.totalQuestoesValidas >= MIN_QUESTOES_JORNADA}
          label="Questões respondidas"
          atual={`${metricas.totalQuestoesValidas}`}
          meta={`≥ ${MIN_QUESTOES_JORNADA}`}
        />
        <ItemProgresso
          ok={metricas.totalErrosAnalisaveis >= MIN_ERROS_ANALISAVEIS_JORNADA}
          label="Erros analisáveis (N1/N2/N3)"
          atual={`${metricas.totalErrosAnalisaveis}`}
          meta={`≥ ${MIN_ERROS_ANALISAVEIS_JORNADA}`}
        />
        <ItemProgresso
          ok={metricas.pctQuestoesComN1N2N3 >= 0.95}
          label="Classificação pedagógica"
          atual={`${pctN1}%`}
          meta="≥ 95%"
        />
      </ul>

      {!elegivel && motivosBloqueio.length > 0 && (
        <p className="mt-4 rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
          {motivosBloqueio[0]}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {elegivel ? (
          <Button type="button" disabled={loading} onClick={iniciarJornada}>
            {loading ? "Iniciando…" : "Iniciar Jornada"}
          </Button>
        ) : (
          <LinkButton href="/provas">Registrar atividade</LinkButton>
        )}
        {temRegistrosProva && (
          <Link
            href="/provas"
            className="self-center text-sm text-slate-600 underline hover:text-indigo-800"
          >
            Ver relatórios de prova
          </Link>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </Card>
  );
}
