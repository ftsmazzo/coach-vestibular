import Link from "next/link";
import { formatDataAplicacao } from "@/lib/data-prova";
import { labelCategoriaRegistro, categoriaDoRegistro } from "@/lib/prova-tipo";
import { Button } from "@/components/ui";
import { PctDonut } from "@/components/pct-donut";

type ExamHero = {
  id: string;
  nome: string;
  data: Date;
  provaId: string | null;
  prova?: { tipo: string } | null;
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
        <Link href="/provas" className="mt-6 inline-block">
          <Button>Ver provas públicas</Button>
        </Link>
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
          <Link href={`/simulados/${exam.id}`}>
            <Button className="w-full !bg-white !text-teal-800 hover:!bg-teal-50">
              Ver diagnóstico completo
            </Button>
          </Link>
          <Link href="/plano">
            <Button variant="secondary" className="w-full !border-white/40 !bg-white/10 !text-white">
              Plano da semana
            </Button>
          </Link>
          <Link href="/quests">
            <Button variant="ghost" className="w-full !text-teal-100 hover:!bg-white/10">
              Minhas quests
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
