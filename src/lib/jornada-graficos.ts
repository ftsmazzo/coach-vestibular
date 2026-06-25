/**
 * Dados serializáveis para a página de gráficos da jornada (contexto JOURNEY).
 * Foca em metacognição + top escopos N2 com mais erro.
 */
import { buildMetacognicaoGlobalJornada } from "@/lib/jornada-metacognicao";
import { getFocosPedagogicosRecentes } from "@/lib/learning-motor-foco";
import { buildResumoJornada } from "@/lib/jornada";

export type CausaGrafico = { label: string; count: number; pct: number; cor: string };
export type CheckInGrafico = { score: number; dataLabel: string };
export type EscopoGrafico = {
  escopoId: string;
  escopoLabel: string;
  materiaLabel: string;
  erros: number;
  taxaAcerto: number;
  estrategia: string | null;
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
  topEscopos: EscopoGrafico[];
};

export async function buildJornadaGraficos(userId: string): Promise<JornadaGraficos> {
  const [meta, focos, resumo] = await Promise.all([
    buildMetacognicaoGlobalJornada(userId),
    getFocosPedagogicosRecentes(userId, 8),
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
    topEscopos: focos.map((f) => ({
      escopoId: f.escopoId,
      escopoLabel: f.escopoLabel,
      materiaLabel: f.materiaLabel,
      erros: f.totalErros,
      taxaAcerto: Math.round(f.taxaAcerto * 100),
      estrategia: f.estrategiaRecomendada,
    })),
  };
}
