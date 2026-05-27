import type { ProvaTipo } from "@/generated/prisma/client";
import { formatDataAplicacao } from "@/lib/data-prova";
import { labelCategoriaRegistro, categoriaDoRegistro } from "@/lib/prova-tipo";
import { LinkButton } from "@/components/ui";
import { PctDonut } from "@/components/pct-donut";

export type ExamHero = {
  id: string;
  nome: string;
  data: Date;
  provaId: string | null;
  prova?: { tipo: ProvaTipo } | null;
  questionAttempts: { correto: boolean }[];
};

export function DashboardHero({
  exam,
  pct,
  counts,
}: {
  exam: ExamHero | undefined;
  pct: number;
  counts: { provas: number; simulados: number };
}) {
  if (!exam) {
    return (
      <div className="rounded-2xl border border-dashed border-teal-200 bg-gradient-to-br from-teal-50 to-white p-8 text-center">
        <h2 className="text-xl font-semibold text-slate-900">Comece pelo seu primeiro registro</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
          Escolha uma prova pública, informe seu gabarito e receba diagnóstico, plano da semana e
          quests.
        </p>
        <LinkButton href="/provas" className="mt-6">
          Ver provas públicas
        </LinkButton>
      </div>
    );
  }

  const cat = categoriaDoRegistro(exam);

  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-teal-600 to-teal-800 text-white shadow-lg shadow-teal-900/10">
      <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
          <PctDonut pct={pct} label="acertos" />
          <div className="text-center sm:text-left">
            <span className="inline-flex rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium text-white">
              {labelCategoriaRegistro(cat)}
            </span>
            <h2 className="mt-2 text-xl font-bold leading-tight sm:text-2xl">{exam.nome}</h2>
            <p className="mt-1 text-sm text-teal-100">
              Aplicada em {formatDataAplicacao(exam.data)}
            </p>
            <p className="mt-2 text-xs text-teal-200/90">
              {counts.provas} prova{counts.provas !== 1 ? "s" : ""} oficial
              {counts.provas !== 1 ? "is" : ""} · {counts.simulados} simulado
              {counts.simulados !== 1 ? "s" : ""} no histórico
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:min-w-[200px]">
          <LinkButton
            href={`/simulados/${exam.id}`}
            className="w-full !bg-white !text-teal-800 hover:!bg-teal-50"
          >
            Ver diagnóstico completo
          </LinkButton>
          <LinkButton
            href="/plano"
            variant="secondary"
            className="w-full !border !border-white/40 !bg-white/10 !text-white hover:!bg-white/20"
          >
            Plano da semana
          </LinkButton>
          <LinkButton
            href="/quests"
            variant="ghost"
            className="w-full !text-teal-100 hover:!bg-white/10"
          >
            Minhas quests
          </LinkButton>
        </div>
      </div>
    </div>
  );
}
