import Link from "next/link";
import type { RegistroDashboardCard } from "@/lib/jornada-analytics";
import { abreviarNomeProva } from "@/lib/prova-label";
import { isConjuntoExamId } from "@/lib/prova-multidia";
import { AtividadeCard } from "@/components/atividade-card";

export function DashboardRegistrosGrid({ registros }: { registros: RegistroDashboardCard[] }) {
  if (registros.length === 0) return null;

  return (
    <div>
      <h2 className="mb-1 text-base font-semibold text-slate-900">Últimas atividades</h2>
      <p className="mb-3 text-xs text-slate-500">
        Cada registro ocupa metade da linha — cores por tipo de atividade.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {registros.map((r) => {
          const conjunto = isConjuntoExamId(r.id);
          const analiseHref = conjunto
            ? `/provas/conjunto/${r.id}/lente`
            : r.provaId
              ? `/provas/${r.provaId}/lente`
              : `/simulados/${r.id}`;
          const dadosHref = conjunto ? `/simulados/${r.id}` : `/simulados/${r.id}`;
          const questsHref = r.provaId ? `/quests?provaId=${r.provaId}` : "/quests";

          return (
            <AtividadeCard
              key={r.id}
              titulo={abreviarNomeProva(r.nome, 42)}
              subtitulo={r.dataLabel}
              tipoAtividade={r.tipoAtividade}
              pct={r.pct}
              analiseHref={analiseHref}
              dadosHref={dadosHref}
              terceiroHref={questsHref}
              terceiroLabel="Quests"
            />
          );
        })}
      </div>
      <p className="mt-2 text-center text-[10px] text-slate-400">
        <Link href="/provas" className="text-teal-700 hover:underline">
          + Ver todas as atividades
        </Link>
      </p>
    </div>
  );
}
