/**
 * Dados serializáveis para a página de gráficos da jornada (contexto JOURNEY).
 * Foca em metacognição (como erra) + conhecimentos/padrões com mais erro.
 */
import { buildMetacognicaoGlobalJornada } from "@/lib/jornada-metacognicao";
import { aggregateKnowledgeGaps, aggregateCognitiveClusters } from "@/lib/knowledge-gaps";
import { buildResumoJornada } from "@/lib/jornada";

export type CausaGrafico = { label: string; count: number; pct: number; cor: string };
export type CheckInGrafico = { score: number; dataLabel: string };
export type ConhecimentoGrafico = {
  texto: string;
  materia: string | null;
  tipoCognitivoLabel: string;
  erros: number;
  pctAcertoMateria: number | null;
  causa: string | null;
};
export type ClusterGrafico = {
  label: string;
  erros: number;
  verboTreino: string;
  causa: string | null;
  materias: string[];
};

export type JornadaGraficos = {
  temDados: boolean;
  totalRegistros: number;
  pctAcertoPonderado: number;
  metacognicao: {
    totalErros: number;
    errosClassificados: number;
    pctErrosClassificados: number;
    mediaCheckIn: number | null;
    causas: CausaGrafico[];
    causaDominante: CausaGrafico | null;
    checkIns: CheckInGrafico[];
    insight: string;
  } | null;
  conhecimentos: ConhecimentoGrafico[];
  clustersCognitivos: ClusterGrafico[];
};

export async function buildJornadaGraficos(userId: string): Promise<JornadaGraficos> {
  const [meta, lacunas, clusters, resumo] = await Promise.all([
    buildMetacognicaoGlobalJornada(userId),
    aggregateKnowledgeGaps(userId, 7),
    aggregateCognitiveClusters(userId, 6),
    buildResumoJornada(userId),
  ]);

  return {
    temDados: resumo.totalRegistros > 0,
    totalRegistros: resumo.totalRegistros,
    pctAcertoPonderado: resumo.pctAcertoPonderado,
    metacognicao: meta
      ? {
          totalErros: meta.totalErros,
          errosClassificados: meta.errosClassificados,
          pctErrosClassificados: meta.pctErrosClassificados,
          mediaCheckIn: meta.mediaCheckIn,
          causas: meta.causas.map((c) => ({
            label: c.label,
            count: c.count,
            pct: c.pct,
            cor: c.cor,
          })),
          causaDominante: meta.causaDominante
            ? {
                label: meta.causaDominante.label,
                count: meta.causaDominante.count,
                pct: meta.causaDominante.pct,
                cor: meta.causaDominante.cor,
              }
            : null,
          checkIns: meta.checkIns,
          insight: meta.insight,
        }
      : null,
    conhecimentos: lacunas.map((l) => ({
      texto: l.texto,
      materia: l.materia,
      tipoCognitivoLabel: l.tipoCognitivoLabel,
      erros: l.erros,
      pctAcertoMateria: l.pctAcertoMateria,
      causa: l.causaDominante?.label ?? null,
    })),
    clustersCognitivos: clusters.map((c) => ({
      label: c.label,
      erros: c.erros,
      verboTreino: c.verboTreino,
      causa: c.causaDominante?.label ?? null,
      materias: c.materias.slice(0, 3),
    })),
  };
}
