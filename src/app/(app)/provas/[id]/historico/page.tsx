import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { buildHistoricoProva } from "@/lib/jornada-historico";
import { labelTipoProva } from "@/lib/prova-tipo";
import { Card, Badge, LinkButton } from "@/components/ui";
import { EvolutionChart } from "@/components/evolution-chart";

export default async function ProvaHistoricoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id: provaId } = await params;
  const historico = await buildHistoricoProva(session.userId, provaId);
  if (!historico) notFound();

  const { prova, tentativas, evolucao, melhorPct, ultimaPct, tendencia } = historico;

  const tendenciaLabel =
    tendencia === "subindo"
      ? { text: "Em alta", tone: "success" as const }
      : tendencia === "caindo"
        ? { text: "Atenção — caiu na última", tone: "warning" as const }
        : tendencia === "estavel"
          ? { text: "Estável", tone: "neutral" as const }
          : null;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap gap-3">
          <Link href="/provas" className="text-sm text-teal-700 hover:underline">
            ← Provas públicas
          </Link>
          <Link href={`/provas/${provaId}/lente`} className="text-sm font-medium text-violet-700 hover:underline">
            Abrir lente da prova →
          </Link>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900">{prova.nome}</h1>
          <Badge tone="neutral">{labelTipoProva(prova.tipo)}</Badge>
        </div>
        <p className="mt-1 text-slate-600">
          {prova.banca}
          {prova.ano ? ` · ${prova.ano}` : ""} — histórico das suas tentativas nesta prova
        </p>
      </div>

      {tentativas.length === 0 ? (
        <Card>
          <p className="text-slate-600">Você ainda não registrou resultado desta prova.</p>
          <LinkButton href={`/simulados/novo?provaId=${prova.id}`} className="mt-4">
            Registrar primeiro resultado
          </LinkButton>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <p className="text-xs text-slate-500">Tentativas</p>
              <p className="text-2xl font-bold text-slate-900">{tentativas.length}</p>
            </Card>
            <Card>
              <p className="text-xs text-slate-500">Melhor resultado</p>
              <p className="text-2xl font-bold text-emerald-700">{melhorPct}%</p>
            </Card>
            <Card>
              <p className="text-xs text-slate-500">Última tentativa</p>
              <p className="text-2xl font-bold text-slate-900">{ultimaPct}%</p>
              {tendenciaLabel && (
                <div className="mt-2">
                  <Badge tone={tendenciaLabel.tone}>{tendenciaLabel.text}</Badge>
                </div>
              )}
            </Card>
          </div>

          {tentativas.length >= 2 && (
            <Card>
              <h2 className="mb-1 font-semibold">Evolução nesta prova</h2>
              <p className="mb-4 text-xs text-slate-500">Por data de aplicação</p>
              <EvolutionChart
                data={evolucao}
                emptyMessage="Registre outra tentativa para ver a linha."
              />
            </Card>
          )}

          <Card>
            <h2 className="mb-4 font-semibold">Todas as tentativas</h2>
            <ul className="space-y-3">
              {[...tentativas].reverse().map((t) => (
                <li
                  key={t.examId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      Aplicada em {t.dataLabel} · {t.pctAcerto}%
                    </p>
                    <p className="text-xs text-slate-500">
                      {t.acertos}/{t.total} acertos · {t.modoUsoLabel}
                      {t.recoveryMode ? " · modo recuperação" : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <LinkButton href={`/simulados/${t.examId}`} variant="secondary">
                      Diagnóstico
                    </LinkButton>
                    <LinkButton href={`/simulados/novo?provaId=${prova.id}`} variant="ghost">
                      Nova tentativa
                    </LinkButton>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      <Card className="bg-teal-50/40 border-teal-100">
        <p className="text-sm text-teal-900">
          <strong>Camada meso:</strong> esta página é o histórico de uma prova do catálogo. O plano
          da semana também considera sua <strong>jornada completa</strong> (outras provas e modos de
          uso) no dashboard.
        </p>
      </Card>
    </div>
  );
}
