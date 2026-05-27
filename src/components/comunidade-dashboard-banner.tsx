import { getRankingSnapshot } from "@/lib/ranking";
import { XP_SUGESTAO_ACEITA, XP_VALORES } from "@/lib/xp-valores";
import { LinkButton } from "@/components/ui";

function medalha(posicao: number) {
  if (posicao === 1) return "🥇";
  if (posicao === 2) return "🥈";
  if (posicao === 3) return "🥉";
  return null;
}

export async function ComunidadeDashboardBanner({ userId }: { userId: string }) {
  const r = await getRankingSnapshot(userId, 8);

  return (
    <section className="overflow-hidden rounded-xl border border-violet-200/70 bg-gradient-to-r from-violet-700 to-indigo-900 text-white shadow-md">
      <div className="grid lg:grid-cols-[1fr_minmax(0,340px)] lg:divide-x lg:divide-white/10">
        {/* Bloco esquerdo — métricas */}
        <div className="flex flex-col justify-between gap-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-300">
                Comunidade
              </p>
              <p className="text-sm font-semibold text-white">Ranking por XP</p>
            </div>
            <LinkButton
              href="/comunidade"
              className="!rounded-lg !px-3 !py-1.5 !text-xs !bg-white !text-violet-900 hover:!bg-violet-50"
            >
              Ver ranking
            </LinkButton>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="min-w-[72px] rounded-lg bg-white/12 px-3 py-2 ring-1 ring-white/10">
              <p className="text-[9px] uppercase text-violet-300">XP</p>
              <p className="text-lg font-bold leading-tight tabular-nums">{r.meuXp}</p>
            </div>
            {r.minhaPosicao != null && (
              <div className="min-w-[72px] rounded-lg bg-white/12 px-3 py-2 ring-1 ring-white/10">
                <p className="text-[9px] uppercase text-violet-300">Posição</p>
                <p className="text-lg font-bold leading-tight tabular-nums">
                  #{r.minhaPosicao}
                  <span className="text-xs font-normal text-violet-300">/{r.totalParticipantes}</span>
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 text-[10px] text-violet-200/90">
            <span className="rounded-md bg-black/15 px-2 py-0.5">+{XP_VALORES.MELHORIA_MATERIA} matéria</span>
            <span className="rounded-md bg-black/15 px-2 py-0.5">+{XP_VALORES.QUESTS_SEMANA} quests</span>
            <span className="rounded-md bg-black/15 px-2 py-0.5">+{XP_SUGESTAO_ACEITA} sugestão</span>
            <span className="rounded-md bg-black/15 px-2 py-0.5">
              +{XP_VALORES.STREAK_3}/{XP_VALORES.STREAK_7} streak
            </span>
          </div>
        </div>

        {/* Bloco direito — lista */}
        <div className="bg-black/10 p-4 sm:px-5">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-violet-300">
            Top 8
          </p>
          {r.top.length === 0 ? (
            <p className="text-xs text-violet-200">Nenhum XP ainda.</p>
          ) : (
            <ol className="space-y-1">
              {r.top.map((e) => (
                <li
                  key={e.userId}
                  className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 text-xs ${
                    e.ehVoce ? "bg-white/15 font-medium" : ""
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="w-4 shrink-0 text-center text-[11px] opacity-90">
                      {medalha(e.posicao) ?? e.posicao}
                    </span>
                    <span className="truncate">
                      {e.apelido}
                      {e.ehVoce && <span className="ml-1 text-violet-300">· você</span>}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-violet-100">{e.xp}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}
