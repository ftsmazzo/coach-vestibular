import type { JornadaDashboardAnalytics } from "@/lib/jornada-analytics";
import { materiasComDadosReais } from "@/lib/jornada-analytics";
import { buildMensagemPanoramaJornada } from "@/lib/leitura-coach";
import { AreaBlocoPieChart } from "@/components/area-bloco-pie-chart";
import { KpiResumoTres } from "@/components/kpi-resumo-tres";
import { ComparativoVestibularesChart } from "@/components/comparativo-vestibulares-chart";
import { EvolucaoVestibularesPanel } from "@/components/evolucao-vestibulares-panel";
import { LeituraCoachCard } from "@/components/leitura-coach-card";
import { Card } from "@/components/ui";
import { MateriaJornadaCharts } from "@/components/materia-jornada-charts";

export function CoachPanoramaJornada({
  analytics,
  evolucao,
}: {
  analytics: JornadaDashboardAnalytics;
  evolucao: Array<{ nome: string; data: string; taxaAcerto: number }>;
}) {
  if (analytics.totalRegistros === 0) return null;

  const mensagem = buildMensagemPanoramaJornada(analytics, evolucao);
  const comDados = materiasComDadosReais(analytics.materiasMedia, 3);
  const piores = [...comDados].sort((a, b) => a.pctAcerto - b.pctAcerto).slice(0, 3);
  const melhores = [...comDados].sort((a, b) => b.pctAcerto - a.pctAcerto).slice(0, 3);
  const areaTop =
    analytics.areasBloco.length > 0
      ? [...analytics.areasBloco].sort((a, b) => b.pctAcerto - a.pctAcerto)[0]!
      : null;

  return (
    <section className="space-y-4">
      <LeituraCoachCard titulo="Panorama da sua jornada" mensagem={mensagem} />

      <KpiResumoTres
        kpi={analytics.evolucaoVestibulares?.ultima ?? null}
        areaDestaque={areaTop ? { label: areaTop.label, pct: areaTop.pctAcerto } : null}
        contexto="vestibulares oficiais"
      />

      {(piores.length > 0 || melhores.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {piores.length > 0 && (
            <Card className="p-4">
              <p className="text-xs font-semibold uppercase text-rose-800">Priorizar</p>
              <p className="mb-2 text-[10px] text-slate-500">Mín. 3 questões na jornada</p>
              <ul className="mt-2 space-y-2">
                {piores.map((m) => (
                  <li key={m.materiaId}>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-800">{m.label}</span>
                      <span className="font-medium text-rose-700">{m.pctAcerto}%</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-rose-400"
                        style={{ width: `${m.pctAcerto}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {melhores.length > 0 && (
            <Card className="p-4">
              <p className="text-xs font-semibold uppercase text-emerald-800">Consolidar</p>
              <p className="mb-2 text-[10px] text-slate-500">Mín. 3 questões na jornada</p>
              <ul className="mt-2 space-y-2">
                {melhores.map((m) => (
                  <li key={m.materiaId}>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-800">{m.label}</span>
                      <span className="font-medium text-emerald-700">{m.pctAcerto}%</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${m.pctAcerto}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {analytics.evolucaoVestibulares && analytics.evolucaoVestibulares.chart.length >= 1 && (
        <EvolucaoVestibularesPanel evolucao={analytics.evolucaoVestibulares} />
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Acerto por grande área</h3>
          <p className="mb-3 text-xs text-slate-500">
            Línguas, Humanas, Naturais e Exatas — soma de todos os seus registros.
          </p>
          <AreaBlocoPieChart areas={analytics.areasBloco} />
        </Card>
        <Card className="lg:col-span-3 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Entre vestibulares oficiais</h3>
          <p className="mb-3 text-xs text-slate-500">
            Compara penúltimo e último vestibular; só matérias que caíram nas duas provas.
          </p>
          <ComparativoVestibularesChart comparativo={analytics.comparativoVestibulares} />
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-slate-900">Matérias na jornada</h3>
        <p className="mb-2 text-xs text-slate-500">
          Média ponderada e evolução por registro — sem contar matéria ausente como 0%.
        </p>
        <MateriaJornadaCharts
          materiasMedia={analytics.materiasMedia}
          seriesPorProva={analytics.seriesPorProva}
          materiaIdsOrdenados={analytics.materiaIdsOrdenados}
        />
      </Card>
    </section>
  );
}
