import type { StudyPlanItem } from "@/lib/study-plan";

/** Quest gerada — virá da IA ou do template, mesma forma para persistir. */
export type QuestGerada = {
  /** slug estável para a chave copiloto (ex.: "foco", "materia-mat", "fadiga") */
  slug: string;
  titulo: string;
  /** corpo já formatado (Por que / O que fazer / Pronto quando) */
  descricao: string;
  duracaoMin: number;
  ordem: number;
  rotulo: string;
  materiaId?: string;
  conhecimentoEscopoId?: string;
  conhecimentoDominioId?: string;
  conceitosCanonicosJson?: string;
  fonteDiagnosticoJson?: string;
  tipoQuest?: string;
};

/** Narrativa humana gravada para a Home e o Plano (não regenera no render). */
export type CopilotoNarrativa = {
  /** gerada por IA ou template */
  fonte: "ia" | "template";
  missaoTitulo: string;
  missaoDescricao: string;
  missaoImpacto: string | null;
  diagnosticoTitulo: string;
  diagnosticoParagrafo: string;
  camadas: {
    oQueAcontece: string;
    comoCognitivo: string;
    quandoAparece: string;
    naoSignifica: string;
    caminho: string;
  } | null;
  /** uma linha ligando anamnese declarada × dados reais */
  linhaAnamnese: string | null;
  geradoEm: string;
};

export type CopilotoGerado = {
  fonte: "ia" | "template";
  narrativa: CopilotoNarrativa;
  planoItems: StudyPlanItem[];
  quests: QuestGerada[];
  recoveryMode: boolean;
};
