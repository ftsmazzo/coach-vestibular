import type { JornadaDashboardAnalytics } from "@/lib/jornada-analytics";
import { buildMensagemPanoramaJornada } from "@/lib/leitura-coach";
import type { StreakRegistros } from "@/lib/streak";
import { textoStreakDashboard } from "@/lib/streak";
import { LeituraCoachCard } from "@/components/leitura-coach-card";
import { Card } from "@/components/ui";
import { MateriaJornadaCharts } from "@/components/materia-jornada-charts";
import { EvolutionChart } from "@/components/evolution-chart";

export function CoachPanoramaJornada({
  analytics,
  evolucao,
  streakInfo,
  counts,
}: {
  analytics: JornadaDashboardAnalytics;
  evolucao: Array<{ nome: string; data: string; taxaAcerto: number }>;
  streakInfo: StreakRegistros;
  counts: { provas: number; simulados: number; todos: number };
}) {
  if (analytics.totalRegistros === 0) return null;

  const mensagem = buildMensagemPanoramaJornada(analytics, evolucao);
  const piores = [...analytics.materiasMedia]
    .sort((a, b) => a.pctAcerto - b.pctAcerto)
    .slice(0, 3);
  const melhores = [...analytics.materiasMedia]
    .sort((a, b) => b.pctAcerto - a.pctAcerto)
    .slice(0, 3);

  return (
    <section className="space-y-4">
      <LeituraCoachCard titulo="Panorama da sua jornada" mensagem={mensagem} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-teal-100 bg-teal-50/40 p-4">
          <p className="text-xs text-slate-500">Acerto ponderado</p>
          <p className="text-2xl font-bold text-teal-900">{analytics.pctGlobalPonderado}%</p>
          <p className="mt-0.5 text-[10px] text-slate-500">toda a jornada</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Registros</p>
          <p className="text-2xl font-bold text-slate-900">{analytics.totalRegistros}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">
            {counts.provas} vestibular · {counts.simulados} simulado
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Sequência no app</p>
          <p className="text-2xl font-bold text-slate-900">{streakInfo.streak} dia{streakInfo.streak !== 1 ? "s" : ""}</p>
          <p className="mt-0.5 text-[10px] leading-snug text-slate-500">
            {textoStreakDashboard(streakInfo)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Matérias na base</p>
          <p className="text-2xl font-bold text-slate-900">{analytics.materiasMedia.length}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">média de todas aplicações</p>
        </Card>
      </div>

      {(piores.length > 0 || melhores.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {piores.length > 0 && (
            <Card className="p-4">
              <p className="text-xs font-semibold uppercase text-rose-800">Priorizar</p>
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

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Progressão geral</h3>
          <p className="mb-3 text-xs text-slate-500">Percentual por data de aplicação</p>
          <EvolutionChart
            data={evolucao}
            emptyMessage="Registre mais atividades para ver a curva."
          />
        </Card>
        <Card className="lg:col-span-3 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Matérias na jornada</h3>
          <p className="mb-2 text-xs text-slate-500">
            Média ponderada e evolução por registro — o mesmo critério do plano semanal.
          </p>
          <MateriaJornadaCharts
            materiasMedia={analytics.materiasMedia}
            seriesPorProva={analytics.seriesPorProva}
            materiaIdsOrdenados={analytics.materiaIdsOrdenados}
          />
        </Card>
      </div>
    </section>
  );
}
