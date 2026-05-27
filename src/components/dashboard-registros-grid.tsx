import Link from "next/link";
import type { RegistroDashboardCard } from "@/lib/jornada-analytics";
import { TEMA_ATIVIDADE } from "@/lib/prova-tipo";
import { abreviarNomeProva } from "@/lib/prova-label";
import { PctDonut } from "@/components/pct-donut";
import { LinkButton } from "@/components/ui";

const btnFino = "!rounded-md !px-2 !py-1 !text-[10px] !font-medium !leading-none";

function AtividadeCard({ r }: { r: RegistroDashboardCard }) {
  const tema = TEMA_ATIVIDADE[r.tipoAtividade];
  const titulo = abreviarNomeProva(r.nome, 42);
  const analiseHref = `/simulados/${r.id}`;
  const dadosHref = r.provaId ? `/provas/${r.provaId}/lente` : analiseHref;
  const questsHref = r.provaId ? `/quests?provaId=${r.provaId}` : "/quests";

  return (
    <article
      className={`flex h-full min-h-[148px] flex-col overflow-hidden rounded-xl text-white shadow-md ${tema.cardClass}`}
    >
      <div className="flex flex-1 items-start gap-2.5 p-3 pb-2">
        <PctDonut pct={r.pct} size="sm" />
        <div className="min-w-0 flex-1">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none ${tema.badgeClass}`}
          >
            {tema.label}
          </span>
          <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-snug">{titulo}</p>
          <p className={`mt-0.5 text-[10px] ${tema.pctMuted}`}>{r.dataLabel}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 border-t border-white/10 p-2">
        <LinkButton href={analiseHref} className={`${btnFino} ${tema.btnPrimary}`}>
          Análise
        </LinkButton>
        <LinkButton href={dadosHref} className={`${btnFino} ${tema.btnOutline}`}>
          Dados
        </LinkButton>
        <LinkButton href={questsHref} className={`${btnFino} ${tema.btnGhost}`}>
          Quests
        </LinkButton>
      </div>
    </article>
  );
}

export function DashboardRegistrosGrid({ registros }: { registros: RegistroDashboardCard[] }) {
  if (registros.length === 0) return null;

  return (
    <div>
      <h2 className="mb-1 text-base font-semibold text-slate-900">Últimas atividades</h2>
      <p className="mb-3 text-xs text-slate-500">
        Cada registro ocupa metade da linha — cores por tipo de atividade.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {registros.map((r) => (
          <AtividadeCard key={r.id} r={r} />
        ))}
      </div>
      <p className="mt-2 text-center text-[10px] text-slate-400">
        <Link href="/provas" className="text-teal-700 hover:underline">
          + Registrar outra prova
        </Link>
      </p>
    </div>
  );
}
