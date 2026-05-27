import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { buildHistoricoProva } from "@/lib/jornada-historico";
import { buildDiagnosisForProva } from "@/lib/jornada-diagnostico";
import { labelTipoProva } from "@/lib/prova-tipo";
import { getMateriaLabel } from "@/lib/taxonomy";
import { GerarMicroPlanoButton } from "@/components/gerar-micro-plano-button";
import { EvolutionChart } from "@/components/evolution-chart";
import { Card, Badge, LinkButton } from "@/components/ui";

export default async function ProvaLentePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id: provaId } = await params;
  const historico = await buildHistoricoProva(session.userId, provaId);
  if (!historico) notFound();

  const diagnosis = await buildDiagnosisForProva(session.userId, provaId);
  const { prova, tentativas, evolucao, melhorPct, ultimaPct, tendencia } = historico;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/provas/${provaId}/historico`} className="text-sm text-teal-700 hover:underline">
          ← Histórico
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900">Lente da prova</h1>
          <Badge tone="neutral">{labelTipoProva(prova.tipo)}</Badge>
        </div>
        <p className="mt-1 text-slate-600">{prova.nome}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-slate-500">Tentativas suas</p>
          <p className="text-2xl font-bold">{tentativas.length}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">Melhor %</p>
          <p className="text-2xl font-bold text-emerald-700">{melhorPct ?? "—"}%</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">Última %</p>
          <p className="text-2xl font-bold">{ultimaPct ?? "—"}%</p>
          {tendencia && (
            <Badge tone={tendencia === "subindo" ? "success" : tendencia === "caindo" ? "warning" : "neutral"}>
              {tendencia === "subindo" ? "Em alta" : tendencia === "caindo" ? "Atenção" : "Estável"}
            </Badge>
          )}
        </Card>
      </div>

      {tentativas.length >= 2 && (
        <Card>
          <h2 className="mb-4 font-semibold">Evolução nesta prova</h2>
          <EvolutionChart data={evolucao} />
        </Card>
      )}

      {diagnosis && diagnosis.materiaScores.length > 0 && (
        <Card>
          <h2 className="mb-4 font-semibold">Desempenho agregado (todas as tentativas)</h2>
          <ul className="space-y-2">
            {diagnosis.materiaScores
              .sort((a, b) => a.taxaAcerto - b.taxaAcerto)
              .map((m) => (
                <li key={m.materiaId}>
                  <div className="flex justify-between text-sm">
                    <span>{m.materiaLabel ?? getMateriaLabel(m.materiaId)}</span>
                    <span>{Math.round(m.taxaAcerto * 100)}%</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-teal-500"
                      style={{ width: `${Math.round(m.taxaAcerto * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
          </ul>
        </Card>
      )}

      <Card className="border-teal-200 bg-teal-50/40">
        <h2 className="font-semibold text-teal-950">Micro-plano desta prova</h2>
        <p className="mt-2 text-sm text-teal-900">
          Gera quests e blocos de estudo só para esta prova do catálogo, com base em todas as suas
          tentativas. O <strong>plano global da semana</strong> continua considerando toda a jornada
          (oficiais + simulados).
        </p>
        {tentativas.length > 0 ? (
          <div className="mt-4">
            <GerarMicroPlanoButton provaId={provaId} />
          </div>
        ) : (
          <LinkButton href={`/simulados/novo?provaId=${provaId}`} className="mt-4">
            Registrar primeiro resultado
          </LinkButton>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Tentativas</h2>
        <ul className="space-y-2">
          {tentativas.map((t) => (
            <li
              key={t.examId}
              className="flex flex-wrap justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
            >
              <span>
                {t.dataLabel} · {t.pctAcerto}%
              </span>
              <Link href={`/simulados/${t.examId}`} className="text-teal-700 hover:underline">
                Abrir registro
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
