/**
 * Tipos e constantes de elegibilidade — seguro para Client Components (sem Prisma).
 */
export const MIN_PROVAS_JORNADA = 2;
export const MIN_QUESTOES_JORNADA = 80;
export const MIN_ERROS_ANALISAVEIS_JORNADA = 15;
export const MIN_PCT_N1N2N3_JORNADA = 0.95;

export type MetricasElegibilidadeJornada = {
  anamneseConcluida: boolean;
  provasOuSimuladosValidos: number;
  totalQuestoesValidas: number;
  totalErrosAnalisaveis: number;
  pctQuestoesComN1N2N3: number;
};

export type ElegibilidadeJornada = {
  elegivel: boolean;
  motivosBloqueio: string[];
  metricas: MetricasElegibilidadeJornada;
};
