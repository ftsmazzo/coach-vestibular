import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { buildHistoricoProva } from "@/lib/jornada-historico";
import { buildDiagnosisForProva } from "@/lib/jornada-diagnostico";
import { getLeituraCoachProva } from "@/lib/leitura-coach";
import { abreviarNomeProva } from "@/lib/prova-label";
import { labelTipoProva } from "@/lib/prova-tipo";
import { getMateriaLabel } from "@/lib/taxonomy";
import { GerarMicroPlanoButton } from "@/components/gerar-micro-plano-button";
import { LeituraCoachCard } from "@/components/leitura-coach-card";
import { ComparativoVestibularesChart } from "@/components/comparativo-vestibulares-chart";
import { EvolutionChart } from "@/components/evolution-chart";
import { KpiResumoTres } from "@/components/kpi-resumo-tres";
import { PageBackLink } from "@/components/page-back-link";
import { ProvaSubNav } from "@/components/prova-sub-nav";
import { Card, Badge, LinkButton } from "@/components/ui";

export default async function ProvaLentePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id: provaId } = await params;
  const [historico, diagnosis, leitura] = await Promise.all([
    buildHistoricoProva(session.userId, provaId),
    buildDiagnosisForProva(session.userId, provaId),
    getLeituraCoachProva(session.userId, provaId),
  ]);
  if (!historico) notFound();

  const {
    prova,
    tentativas,
    evolucao,
    kpiUltima,
    comparativoTentativas,
  } = historico;
  const tituloProva = abreviarNomeProva(prova.nome);

  const areaDestaqueLente =
    diagnosis && diagnosis.materiaScores.length > 0
      ? (() => {
          const m = [...diagnosis.materiaScores].sort((a, b) => b.taxaAcerto - a.taxaAcerto)[0]!;
          return {
            label: m.materiaLabel ?? getMateriaLabel(m.materiaId),
            pct: Math.round(m.taxaAcerto * 100),
          };
        })()
      : null;

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <PageBackLink href="/provas">Provas públicas</PageBackLink>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Sua lente</h1>
          <Badge tone="neutral">{labelTipoProva(prova.tipo)}</Badge>
        </div>
        <p className="text-sm font-medium text-slate-700">{tituloProva}</p>
        {prova.nome.length > tituloProva.length && (
          <p className="text-xs text-slate-500">{prova.nome}</p>
        )}
        <ProvaSubNav provaId={provaId} active="lente" />
      </header>

      {leitura && (
        <LeituraCoachCard
          titulo={leitura.tituloProva}
          mensagem={leitura.mensagem}
          focos={leitura.focos}
          pctReferencia={leitura.pctReferencia}
        />
      )}

      {tentativas.length > 0 && (
        <KpiResumoTres
          kpi={kpiUltima}
          areaDestaque={areaDestaqueLente}
          contexto="tentativas nesta prova"
        />
      )}

      {tentativas.length >= 2 && (
        <Card className="p-4">
          <h2 className="font-semibold text-slate-900">Sua evolução neste vestibular</h2>
          <p className="mb-4 text-xs text-slate-500">
            Cada tentativa na mesma prova do catálogo — KPIs comparam a última com todas as
            anteriores.
          </p>
          <EvolutionChart data={evolucao} />
        </Card>
      )}

      {comparativoTentativas && tentativas.length >= 2 && (
        <Card className="p-4">
          <h2 className="mb-1 font-semibold text-slate-900">Matérias: penúltima × última tentativa</h2>
          <p className="mb-4 text-xs text-slate-500">
            Só matérias com questões nas duas aplicações — sem penalizar matéria que não caiu.
          </p>
          <ComparativoVestibularesChart comparativo={comparativoTentativas} />
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
          <LinkButton href={`/simulados/novo?provaId=${provaId}`} className="mt-4 w-full sm:w-auto">
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
              className="flex flex-col gap-2 rounded-lg border px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="font-medium text-slate-800">
                {t.dataLabel} · {t.pctAcerto}%
              </span>
              <Link
                href={`/simulados/${t.examId}`}
                className="inline-flex min-h-11 items-center font-medium text-teal-700 hover:underline sm:min-h-0"
              >
                Análise da prova →
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
