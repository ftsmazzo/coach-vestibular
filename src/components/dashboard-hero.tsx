import type { ProvaTipo } from "@/generated/prisma/client";
import { formatDataAplicacao } from "@/lib/data-prova";
import { categoriaDoRegistro, labelMarcadorAtividade } from "@/lib/prova-tipo";
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

const btnCompact =
  "w-full !rounded-lg !px-3 !py-1.5 !text-xs !font-semibold";

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
  const dadosProvaHref = exam.provaId
    ? `/provas/${exam.provaId}/lente`
    : `/simulados/${exam.id}`;

  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-teal-600 to-teal-800 text-white shadow-lg shadow-teal-900/10">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 flex-col items-center gap-3 sm:flex-row sm:items-center">
          <PctDonut pct={pct} size="md" label="acertos" />
          <div className="min-w-0 text-center sm:text-left">
            <span className="inline-flex rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium text-white">
              {labelMarcadorAtividade(cat)}
            </span>
            <h2 className="mt-1.5 line-clamp-3 text-base font-bold leading-snug sm:text-lg">
              {exam.nome}
            </h2>
            <p className="mt-1 text-xs text-teal-100">
              Aplicada em {formatDataAplicacao(exam.data)}
            </p>
            <p className="mt-1.5 text-[10px] text-teal-200/90">
              {counts.provas} {counts.provas === 1 ? "vestibular" : "vestibulares"} · {counts.simulados}{" "}
              {counts.simulados === 1 ? "simulado" : "simulados"} no histórico
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5 sm:w-[168px]">
          <LinkButton
            href={`/simulados/${exam.id}`}
            className={`${btnCompact} !bg-white !text-teal-800 hover:!bg-teal-50`}
          >
            Análise da prova
          </LinkButton>
          <LinkButton
            href={dadosProvaHref}
            variant="secondary"
            className={`${btnCompact} !border !border-white/40 !bg-white/10 !text-white hover:!bg-white/20`}
          >
            Dados da prova
          </LinkButton>
          <LinkButton
            href="/quests"
            variant="ghost"
            className={`${btnCompact} !text-teal-100 hover:!bg-white/10`}
          >
            Minhas quests
          </LinkButton>
        </div>
      </div>
    </div>
  );
}
