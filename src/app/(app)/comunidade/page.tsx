import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getRankingSnapshot } from "@/lib/ranking";
import { ConquistasGrid } from "@/components/conquistas-grid";
import { XpComoGanhar } from "@/components/xp-como-ganhar";
import { PageBackLink } from "@/components/page-back-link";
import { Card, Badge } from "@/components/ui";

export default async function ComunidadePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "ADMIN") redirect("/admin");

  const r = await getRankingSnapshot(session.userId, 50);

  return (
    <div className="space-y-6">
      <header>
        <PageBackLink href="/dashboard">Dashboard</PageBackLink>
        <h1 className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">Comunidade</h1>
        <p className="mt-1 text-sm text-slate-600 sm:text-base">
          Ranking interno por XP — colabore corrigindo classificações e suba na lista.
        </p>
      </header>

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
          Cada pessoa escolhe o <strong>nome no ranking</strong> em Perfil (ou usa apelido automático)
          — ninguém vê nome completo nem cursinho.
        </p>
      </Card>

      <XpComoGanhar />

      <Card>
        <h2 className="mb-4 font-semibold text-slate-900">Ranking</h2>
        {r.top.length === 0 ? (
          <p className="text-sm text-slate-500">Ainda não há participantes com XP.</p>
        ) : (
          <ol className="space-y-2">
            {r.top.map((e) => (
              <li
                key={e.userId}
                className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                  e.ehVoce ? "border-violet-300 bg-violet-50/80" : "border-slate-100"
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      e.posicao <= 3
                        ? "bg-amber-100 text-amber-900"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {e.posicao}
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-slate-900">
                      <span className="truncate">{e.apelido}</span>
                      {e.ehVoce && <Badge tone="success">Você</Badge>}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-base font-semibold tabular-nums text-violet-800 sm:text-lg">
                  {e.xp} XP
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <ConquistasGrid userId={session.userId} />

      <p className="text-sm text-slate-500">
        Dica: ao revisar um registro, use <strong>Classificação errada?</strong> nas questões em que
        a matéria não bate com o enunciado.{" "}
        <Link href="/perfil" className="text-teal-700 hover:underline">
          Ajuste sua meta de vestibular
        </Link>{" "}
        para priorizar a banca certa no plano.
      </p>
    </div>
  );
}
