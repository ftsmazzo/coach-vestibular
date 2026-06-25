import type { DiagnosisResult } from "./diagnosis";

export type BlocoPlano =
  | "diagnostico"
  | "analise_materia"
  | "contexto"
  | "prioridade_materia"
  | "foco_profundo"
  | "consolidacao"
  | "manutencao"
  | "integracao"
  | "meta";

export interface StudyPlanItem {
  ordem: number;
  titulo: string;
  descricao: string;
  materiaId?: string;
  temaId?: string;
  tipoErro?: string;
  duracaoMin: number;
  numerosQuestoes?: number[];
  conhecimentoExigido?: string | null;
  nivelDificuldade?: string | null;
  bloco?: BlocoPlano;
  materiaDestaque?: string;
  errosNaMateria?: number;
  errosContexto?: "prova" | "jornada";
  geraQuest?: boolean;
}

export function planToQuests(
  items: StudyPlanItem[],
  userId: string
): Array<{
  userId: string;
  titulo: string;
  descricao: string;
  materiaId?: string;
  temaId?: string;
  duracaoMin: number;
  rewardMsg: string;
}> {
  return items
    .filter((item) => item.geraQuest !== false && item.duracaoMin > 0)
    .map((item) => {
      const onde =
        item.errosContexto === "prova" ? "na prova" : "na jornada";
      const erros =
        item.numerosQuestoes?.length &&
        item.errosNaMateria != null &&
        item.errosNaMateria > 0
          ? ` (${item.errosNaMateria} erro${item.errosNaMateria > 1 ? "s" : ""} ${onde})`
          : "";
      return {
        userId,
        titulo: item.titulo,
        descricao: item.descricao + erros,
        materiaId: item.materiaId,
        temaId: item.temaId,
        duracaoMin: item.duracaoMin,
        rewardMsg:
          item.bloco === "integracao"
            ? "Integrar o que estudou com a prova real é o que transforma diagnóstico em nota."
            : item.conhecimentoExigido
              ? `Dominar ${item.titulo} fecha uma lacuna que a prova já mostrou.`
              : `Bloco completo: ${item.titulo}. Plano equilibrado = prioridade + base + manutenção.`,
      };
    });
}

/** @deprecated motor v1 usa plano-coach-ia / copiloto — mantido só para tipos */
export type _DiagnosisResultLegacy = DiagnosisResult;
