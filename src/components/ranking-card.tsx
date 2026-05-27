import Link from "next/link";
import { getRankingSnapshot } from "@/lib/ranking";
import { XP_SUGESTAO_ACEITA } from "@/lib/modo-uso";
import { Card, Badge } from "@/components/ui";

export async function RankingCard({ userId }: { userId: string }) {
  const r = await getRankingSnapshot(userId);

  if (r.totalParticipantes === 0) return null;

  return (
    <Card className="border-violet-200 bg-gradient-to-br from-violet-50/60 to-white">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">
            Comunidade
          </p>
          <p className="mt-1 text-lg font-bold text-slate-900">
            {r.meuXp} XP
            {r.minhaPosicao != null && (
              <span className="ml-2 text-base font-normal text-slate-600">
                · #{r.minhaPosicao} de {r.totalParticipantes}
              </span>
            )}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Ganhe {XP_SUGESTAO_ACEITA} XP quando uma sugestão de classificação for aceita.
          </p>
        </div>
      </div>

      {r.top.length > 0 && (
        <ol className="mt-4 space-y-1.5">
          {r.top.slice(0, 8).map((e) => (
            <li
              key={e.userId}
              className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-sm ${
                e.ehVoce ? "bg-violet-100/80 font-medium" : "bg-white/60"
              }`}
            >
              <span className="text-slate-800">
                <span className="mr-2 text-slate-400 w-5 inline-block">{e.posicao}.</span>
                {e.apelido}
                {e.ehVoce && (
                  <span className="ml-2 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                    você
                  </span>
                )}
              </span>
              <span className="text-violet-800">{e.xp} XP</span>
            </li>
          ))}
        </ol>
      )}

      <Link
        href="/comunidade"
        className="mt-3 inline-block text-sm font-medium text-violet-700 hover:underline"
      >
        Ver ranking completo →
      </Link>
    </Card>
  );
}
