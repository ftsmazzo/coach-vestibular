/**
 * Validador determinístico de quests da Jornada — docs/MOTOR-PLANO-QUESTS.md §14.
 */
import type { TipoQuestJornada } from "@/lib/jornada-quest-templates";

export const FRASES_PROIBIDAS_QUEST = [
  "estudar mais",
  "revisar conteúdo",
  "revisar conteudo",
  "reforçar conhecimentos",
  "reforcar conhecimentos",
  "aprofundar estudos",
  "melhorar interpretação",
  "melhorar interpretacao",
  "fazer exercícios",
  "fazer exercicios",
  "buscar entender",
  "treinar mais",
  "dominar o conteúdo",
  "dominar o conteudo",
  "consolidar domínio",
  "consolidar dominio",
  "garantir evolução",
  "garantir evolucao",
] as const;

export const VERBOS_ACAO_QUEST = [
  "refaça",
  "refaca",
  "marque",
  "escreva",
  "compare",
  "explique",
  "resolva",
  "registre",
  "separe",
  "confira",
  "classifique",
  "justifique",
  "liste",
  "identifique",
] as const;

export type FonteDiagnosticoQuestJornada = {
  versao: "1.0";
  origem: "LearningCycle" | "JourneyDiagnosticSnapshot";
  cicloId: string;
  snapshotId?: string;
  escopoId?: string | null;
  dominioId?: string | null;
  conhecimentoExigido?: string[];
  tiposErro?: Record<string, number>;
  motivo: string;
  criterioConclusao: string;
  excecaoSemEscopo?: boolean;
};

export type QuestJornadaDraft = {
  cicloId: string;
  conhecimentoDominioId?: string | null;
  conhecimentoEscopoId?: string | null;
  tipoQuest: TipoQuestJornada;
  titulo: string;
  descricao: string;
  criterioConclusao: string;
  duracaoEstimadaMin?: number;
  dificuldade?: "LEVE" | "MEDIA" | "FORTE";
  fonteDiagnosticoJson: FonteDiagnosticoQuestJornada;
};

export type ResultadoValidacaoQuest = {
  valida: boolean;
  motivos: string[];
};

function textoCompleto(q: QuestJornadaDraft): string {
  return `${q.titulo} ${q.descricao} ${q.criterioConclusao}`.toLowerCase();
}

export function validarQuestJornada(
  quest: QuestJornadaDraft,
  foco: { escopoId?: string | null; titulo: string }
): ResultadoValidacaoQuest {
  const motivos: string[] = [];

  if (!quest.cicloId?.trim()) motivos.push("sem cicloId");
  if (!quest.fonteDiagnosticoJson) motivos.push("sem fonteDiagnosticoJson");
  if (!quest.criterioConclusao?.trim()) motivos.push("sem criterioConclusao");
  if ((quest.titulo?.trim().length ?? 0) < 8) motivos.push("titulo curto");
  if ((quest.descricao?.trim().length ?? 0) < 80) motivos.push("descricao curta");

  const texto = textoCompleto(quest);
  const temVerbo = VERBOS_ACAO_QUEST.some((v) => texto.includes(v));
  if (!temVerbo) motivos.push("sem verbo de acao observavel");

  for (const frase of FRASES_PROIBIDAS_QUEST) {
    if (texto.includes(frase)) {
      motivos.push(`linguagem vaga: ${frase}`);
      break;
    }
  }

  if (
    /domínio consolidado|dominio consolidado|evolução global|evolucao global|garantir aprovação|garantir aprovacao/.test(
      texto
    )
  ) {
    motivos.push("promete dominio ou evolucao global");
  }

  const semEscopo = !quest.conhecimentoEscopoId?.trim();
  if (semEscopo && !quest.fonteDiagnosticoJson?.excecaoSemEscopo) {
    motivos.push("sem escopoId sem justificativa cognitiva");
  }

  if (
    foco.escopoId &&
    quest.conhecimentoEscopoId &&
    quest.conhecimentoEscopoId !== foco.escopoId &&
    !quest.fonteDiagnosticoJson?.excecaoSemEscopo
  ) {
    motivos.push("escopo da quest diferente do foco do ciclo");
  }

  return { valida: motivos.length === 0, motivos };
}

export function logRejeicaoQuest(quest: QuestJornadaDraft, motivos: string[]): void {
  console.warn(
    JSON.stringify({
      evento: "jornada_quest_rejeitada",
      tipoQuest: quest.tipoQuest,
      titulo: quest.titulo,
      cicloId: quest.cicloId,
      motivos,
    })
  );
}
