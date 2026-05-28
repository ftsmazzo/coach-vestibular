/**
 * Clusters pedagógicos — Camada 2 entre conhecimento bruto e narrativa.
 * Nunca usar texto bruto da questão como headline.
 */
import type { ErrorType } from "@/generated/prisma/client";
import type { TipoCognitivoId } from "@/lib/tipo-cognitivo";
import { inferirTipoCognitivo } from "@/lib/tipo-cognitivo";

export type PedagogicalClusterId =
  | "modelagem_matematica"
  | "calculo_procedimento"
  | "visualizacao_espacial"
  | "interpretacao_textual"
  | "analise_linguistica"
  | "recuperacao_conceitual"
  | "comparacao_contextual"
  | "inferencia_logica"
  | "aplicacao_conceitual";

export type ClusterPedagogicoDef = {
  id: PedagogicalClusterId;
  label: string;
  operacaoCognitiva: string;
  /** Diagnóstico abstrato (headline) — não é exemplo de questão */
  diagnosticoAbstrato: string;
  verboTreino: string;
};

export const CLUSTERS_PEDAGOGICOS: Record<PedagogicalClusterId, ClusterPedagogicoDef> = {
  modelagem_matematica: {
    id: "modelagem_matematica",
    label: "Modelagem matemática",
    operacaoCognitiva: "Modelagem e tradução de problema",
    diagnosticoAbstrato:
      "Dificuldade em transformar enunciados em estrutura matemática (equação, gráfico, relações).",
    verboTreino: "passar do texto do problema para modelo antes de calcular",
  },
  calculo_procedimento: {
    id: "calculo_procedimento",
    label: "Cálculo e procedimento",
    operacaoCognitiva: "Execução algorítmica",
    diagnosticoAbstrato:
      "Erros frequentes na execução de procedimentos e contas, mesmo quando o raciocínio inicial faz sentido.",
    verboTreino: "treinar procedimento com conferência em etapas",
  },
  visualizacao_espacial: {
    id: "visualizacao_espacial",
    label: "Visualização espacial",
    operacaoCognitiva: "Visualização e leitura de figuras",
    diagnosticoAbstrato:
      "Dificuldade em interpretar figuras, gráficos e relações espaciais exigidas pela questão.",
    verboTreino: "desenhar e rotular antes de responder",
  },
  interpretacao_textual: {
    id: "interpretacao_textual",
    label: "Interpretação textual",
    operacaoCognitiva: "Interpretação e inferência em texto",
    diagnosticoAbstrato:
      "Perda de precisão em leitura contextual longa e em inferências a partir do texto-base.",
    verboTreino: "ler em duas passadas (global → detalhe) antes de marcar",
  },
  analise_linguistica: {
    id: "analise_linguistica",
    label: "Análise linguística",
    operacaoCognitiva: "Análise sintática e estrutural",
    diagnosticoAbstrato:
      "Baixa automatização ao recuperar estruturas gramaticais e funções sintáticas sob pressão.",
    verboTreino: "fixar regras com micro-drills antes de provas longas",
  },
  recuperacao_conceitual: {
    id: "recuperacao_conceitual",
    label: "Recuperação conceitual",
    operacaoCognitiva: "Recuperação de teoria",
    diagnosticoAbstrato:
      "Dificuldade em recuperar conceitos teóricos no momento da prova, mesmo com estudo prévio.",
    verboTreino: "cartões de recuperação ativa + questões que forcem o conceito",
  },
  comparacao_contextual: {
    id: "comparacao_contextual",
    label: "Comparação contextual",
    operacaoCognitiva: "Comparação e contextualização",
    diagnosticoAbstrato:
      "Dificuldade em comparar casos, períodos ou perspectivas e tirar conclusões válidas.",
    verboTreino: "treinar quadros comparativos (causa, efeito, limite)",
  },
  inferencia_logica: {
    id: "inferencia_logica",
    label: "Inferência lógica",
    operacaoCognitiva: "Raciocínio lógico e dedução",
    diagnosticoAbstrato:
      "Quebras no encadeamento lógico entre premissas e conclusão exigidas pela questão.",
    verboTreino: "explicitar cada passo do raciocínio por escrito",
  },
  aplicacao_conceitual: {
    id: "aplicacao_conceitual",
    label: "Aplicação em contexto",
    operacaoCognitiva: "Aplicação prática",
    diagnosticoAbstrato:
      "Dificuldade em aplicar conceito estudado em situação nova ou interdisciplinar.",
    verboTreino: "variar contextos nas listas (não só um tipo de enunciado)",
  },
};

const MATERIAS_EXATAS = [
  "matematica",
  "matemática",
  "fisica",
  "física",
  "quimica",
  "química",
];

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function materiaEhExata(materia: string | null): boolean {
  if (!materia) return false;
  const n = norm(materia);
  return MATERIAS_EXATAS.some((m) => n.includes(m));
}

function materiaEhHumanas(materia: string | null): boolean {
  if (!materia) return false;
  const n = norm(materia);
  return /portugu|historia|história|geografia|filosof|sociolog|ingles|espanhol|literatura/.test(n);
}

/** Camada 2: classifica conhecimento bruto → cluster pedagógico. */
export function classificarClusterPedagogico(
  conhecimentoBruto: string,
  materia: string | null,
  assunto?: string | null
): PedagogicalClusterId {
  const t = `${conhecimentoBruto} ${assunto ?? ""}`;
  const tipo = inferirTipoCognitivo(conhecimentoBruto).id;

  if (materiaEhExata(materia)) {
    if (tipo === "calculo") return "calculo_procedimento";
    if (tipo === "visualizacao") return "visualizacao_espacial";
    if (tipo === "modelagem" || tipo === "logica") return "modelagem_matematica";
    if (tipo === "recuperacao_conceitual" || tipo === "aplicacao") return "recuperacao_conceitual";
    return "modelagem_matematica";
  }

  if (materiaEhHumanas(materia)) {
    if (tipo === "linguagem") return "analise_linguistica";
    if (tipo === "interpretacao" || tipo === "leitura") return "interpretacao_textual";
    if (tipo === "comparacao") return "comparacao_contextual";
    if (tipo === "inferencia") return "inferencia_logica";
  }

  switch (tipo) {
    case "modelagem":
      return "modelagem_matematica";
    case "calculo":
      return "calculo_procedimento";
    case "visualizacao":
      return "visualizacao_espacial";
    case "linguagem":
      return "analise_linguistica";
    case "interpretacao":
    case "leitura":
      return "interpretacao_textual";
    case "comparacao":
      return "comparacao_contextual";
    case "inferencia":
    case "logica":
      return "inferencia_logica";
    case "recuperacao_conceitual":
      return "recuperacao_conceitual";
    case "aplicacao":
      return "aplicacao_conceitual";
    default:
      return materiaEhExata(materia) ? "modelagem_matematica" : "interpretacao_textual";
  }
}

const METACOG_POR_CAUSA: Partial<Record<ErrorType, string>> = {
  CONCEITO_TEORICO:
    "O padrão metacognitivo aponta falha em recuperar a teoria no momento da questão — não só desatenção.",
  INTERPRETACAO_ENUNCIADO:
    "Muitos erros vêm de interpretar mal o que foi pedido, antes de falta de conteúdo.",
  CALCULO_BOBEIRA:
    "Há perda de precisão na execução (conta/procedimento) — vale ritual de conferência.",
  FALTA_TEMPO:
    "Pressão de tempo aparece no padrão — treinos cronometrados por bloco ajudam.",
  CHUTE_TOTAL:
    "Chutes indicam insegurança conceitual — reduza incerteza com estudo dirigido ao cluster.",
  DUVIDA_CRUCIAL:
    "Dúvidas pontuais não resolvidas se repetem — feche o conceito em 20 min de teoria focada.",
};

export function padraoMetacognitivoCluster(
  causa: ErrorType | null,
  pct: number | null
): string | null {
  if (!causa) return null;
  const base = METACOG_POR_CAUSA[causa];
  if (!base) return null;
  if (pct != null && pct >= 40) {
    return `${base} (${pct}% dos erros classificados neste padrão).`;
  }
  return base;
}
