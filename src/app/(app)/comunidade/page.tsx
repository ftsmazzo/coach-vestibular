import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getRankingSnapshot } from "@/lib/ranking";
import { XP_SUGESTAO_ACEITA } from "@/lib/modo-uso";
import { Card, Badge } from "@/components/ui";

export default async function ComunidadePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "ADMIN") redirect("/admin");

  const r = await getRankingSnapshot(session.userId, 50);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard" className="text-sm text-teal-700 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Comunidade</h1>
        <p className="mt-1 text-slate-600">
          Ranking interno por XP — colabore corrigindo classificações e suba na lista.
        </p>
      </div>

      <Card className="border-violet-200 bg-violet-50/40">
        <p className="text-sm text-violet-950">
          <strong>Seu saldo:</strong> {r.meuXp} XP
          {r.minhaPosicao != null && (
            <>
              {" "}
              · posição <strong>#{r.minhaPosicao}</strong> de {r.totalParticipantes} alunos
            </>
          )}
        </p>
        <p className="mt-2 text-xs text-violet-800">
          Cada sugestão aceita pelo admin vale <strong>{XP_SUGESTAO_ACEITA} XP</strong>. Em breve:
          medalhas e recompensas extras.
        </p>
      </Card>

      <Card>
        <h2 className="mb-4 font-semibold text-slate-900">Ranking</h2>
        {r.top.length === 0 ? (
          <p className="text-sm text-slate-500">Ainda não há participantes com XP.</p>
        ) : (
          <ol className="space-y-2">
            {r.top.map((e) => (
              <li
                key={e.userId}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 ${
                  e.ehVoce ? "border-violet-300 bg-violet-50/80" : "border-slate-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                      e.posicao <= 3
                        ? "bg-amber-100 text-amber-900"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {e.posicao}
                  </span>
                  <div>
                    <p className="font-medium text-slate-900">
                      {e.nome}
                      {e.ehVoce && (
                        <Badge tone="success">Você</Badge>
                      )}
                    </p>
                    {e.sugestoesAceitas > 0 && (
                      <p className="text-xs text-slate-500">
                        {e.sugestoesAceitas} sugestão{e.sugestoesAceitas !== 1 ? "ões" : ""}{" "}
                        aceita{e.sugestoesAceitas !== 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-lg font-semibold text-violet-800">{e.xp} XP</span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <p className="text-sm text-slate-500">
        Dica: ao revisar um registro, use <strong>Classificação errada?</strong> nas questões em que
        a matéria não bate com o enunciado.
      </p>
    </div>
  );
}
