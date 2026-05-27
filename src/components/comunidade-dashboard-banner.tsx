import Link from "next/link";
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
  const r = await getRankingSnapshot(userId, 10);
  const pctTop =
    r.minhaPosicao != null && r.totalParticipantes > 0
      ? Math.round((1 - (r.minhaPosicao - 1) / r.totalParticipantes) * 100)
      : null;

  return (
    <section className="overflow-hidden rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-900 text-white shadow-lg shadow-violet-900/20">
      <div className="relative p-6 sm:p-8">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-indigo-400/20 blur-3xl"
          aria-hidden
        />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-200">
              Comunidade Coach
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Ranking por XP — suba jogando junto
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-violet-100/95">
              Nome no ranking é o que você escolhe em Perfil (ou apelido automático). Ganhe XP com
              melhorias, quests, streak e sugestões aceitas — sem expor seu nome completo.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <div className="rounded-xl bg-white/15 px-4 py-3 backdrop-blur-sm ring-1 ring-white/20">
                <p className="text-[10px] font-medium uppercase text-violet-200">Seu saldo</p>
                <p className="text-2xl font-bold">{r.meuXp} XP</p>
              </div>
              {r.minhaPosicao != null && (
                <div className="rounded-xl bg-white/15 px-4 py-3 backdrop-blur-sm ring-1 ring-white/20">
                  <p className="text-[10px] font-medium uppercase text-violet-200">Posição</p>
                  <p className="text-2xl font-bold">
                    #{r.minhaPosicao}
                    <span className="text-base font-normal text-violet-200">
                      {" "}
                      / {r.totalParticipantes}
                    </span>
                  </p>
                  {pctTop != null && pctTop > 0 && (
                    <p className="mt-0.5 text-[10px] text-violet-200">
                      Acima de {pctTop}% dos participantes
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <LinkButton
                href="/comunidade"
                className="!bg-white !text-violet-900 hover:!bg-violet-50 !font-semibold"
              >
                Abrir comunidade
              </LinkButton>
              <LinkButton
                href="/perfil"
                variant="ghost"
                className="!border !border-white/30 !text-white hover:!bg-white/10"
              >
                Nome no ranking
              </LinkButton>
            </div>
          </div>

          <div className="w-full lg:max-w-md">
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur-md ring-1 ring-white/15">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-violet-200">
                Top do ranking
              </p>
              {r.top.length === 0 ? (
                <p className="text-sm text-violet-100">
                  Seja o primeiro a acumular XP — registre provas e complete quests.
                </p>
              ) : (
                <ol className="space-y-2">
                  {r.top.map((e) => (
                    <li
                      key={e.userId}
                      className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${
                        e.ehVoce ? "bg-white/20 font-semibold ring-1 ring-white/30" : "bg-black/10"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="w-6 shrink-0 text-center text-base">
                          {medalha(e.posicao) ?? (
                            <span className="text-xs text-violet-300">{e.posicao}</span>
                          )}
                        </span>
                        <span className="truncate text-white">
                          {e.apelido}
                          {e.ehVoce && (
                            <span className="ml-1.5 rounded-full bg-violet-500/80 px-1.5 py-0.5 text-[10px]">
                              você
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">{e.xp} XP</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <ul className="mt-3 grid gap-1.5 text-[11px] text-violet-200/90 sm:grid-cols-2">
              <li>+{XP_VALORES.MELHORIA_MATERIA} melhoria em matéria</li>
              <li>+{XP_VALORES.QUESTS_SEMANA} quests da semana</li>
              <li>+{XP_SUGESTAO_ACEITA} sugestão aceita</li>
              <li>+{XP_VALORES.STREAK_3}/{XP_VALORES.STREAK_7} streak</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
