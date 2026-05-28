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
  /** Frase para o aluno — sem jargão de cluster/registro */
  diagnosticoHumano: string;
  /** Ação concreta da semana */
  proximoPassoSemana: string;
  verboTreino: string;
};

export const CLUSTERS_PEDAGOGICOS: Record<PedagogicalClusterId, ClusterPedagogicoDef> = {
  modelagem_matematica: {
    id: "modelagem_matematica",
    label: "Modelagem matemática",
    operacaoCognitiva: "Modelagem e tradução de problema",
    diagnosticoAbstrato:
      "Dificuldade em transformar enunciados em estrutura matemática (equação, gráfico, relações).",
    diagnosticoHumano:
      "O enunciado faz sentido na leitura, mas na hora de virar equação, gráfico ou relação você trava.",
    proximoPassoSemana:
      "Escolha 3 questões de Matemática: antes de calcular, escreva em uma linha o que a questão pede e qual modelo usar.",
    verboTreino: "passar do texto do problema para modelo antes de calcular",
  },
  calculo_procedimento: {
    id: "calculo_procedimento",
    label: "Cálculo e procedimento",
    operacaoCognitiva: "Execução algorítmica",
    diagnosticoAbstrato:
      "Erros frequentes na execução de procedimentos e contas, mesmo quando o raciocínio inicial faz sentido.",
    diagnosticoHumano:
      "Você costuma entender o caminho, mas a conta ou o último passo escapa — vale ritual de conferência.",
    proximoPassoSemana:
      "Em 15 questões, marque cada etapa da conta no papel e confira só o resultado final no fim.",
    verboTreino: "treinar procedimento com conferência em etapas",
  },
  visualizacao_espacial: {
    id: "visualizacao_espacial",
    label: "Visualização espacial",
    operacaoCognitiva: "Visualização e leitura de figuras",
    diagnosticoAbstrato:
      "Dificuldade em interpretar figuras, gráficos e relações espaciais exigidas pela questão.",
    diagnosticoHumano:
      "Quando entra figura, ângulo ou relação no desenho, a imagem não vira um plano claro para a resposta.",
    proximoPassoSemana:
      "3 questões por dia com figura: desenhe, rotule ângulos e só depois monte a conta.",
    verboTreino: "desenhar e rotular antes de responder",
  },
  interpretacao_textual: {
    id: "interpretacao_textual",
    label: "Interpretação textual",
    operacaoCognitiva: "Interpretação e inferência em texto",
    diagnosticoAbstrato:
      "Perda de precisão em leitura contextual longa e em inferências a partir do texto-base.",
    diagnosticoHumano:
      "Em textos longos, você perde o fio ou a inferência que a banca espera — não necessariamente o conteúdo isolado.",
    proximoPassoSemana:
      "Leia o texto uma vez só para ideia central; na segunda passada, sublinhe o que responde ao comando.",
    verboTreino: "ler em duas passadas (global → detalhe) antes de marcar",
  },
  analise_linguistica: {
    id: "analise_linguistica",
    label: "Análise linguística",
    operacaoCognitiva: "Análise sintática e estrutural",
    diagnosticoAbstrato:
      "Baixa automatização ao recuperar estruturas gramaticais e funções sintáticas sob pressão.",
    diagnosticoHumano:
      "Regras de gramática existem no caderno, mas na prova a recuperação da estrutura demora ou falha.",
    proximoPassoSemana:
      "10 min de teoria + 10 questões curtas só da regra que mais errou — sem lista gigante.",
    verboTreino: "fixar regras com micro-drills antes de provas longas",
  },
  recuperacao_conceitual: {
    id: "recuperacao_conceitual",
    label: "Recuperação conceitual",
    operacaoCognitiva: "Recuperação de teoria",
    diagnosticoAbstrato:
      "Dificuldade em recuperar conceitos teóricos no momento da prova, mesmo com estudo prévio.",
    diagnosticoHumano:
      "Você já estudou o tema, mas na hora H o conceito não aparece com clareza.",
    proximoPassoSemana:
      "Cartões ou fichas: pergunta de um lado, conceito do outro — 15 min/dia antes de questões.",
    verboTreino: "cartões de recuperação ativa + questões que forcem o conceito",
  },
  comparacao_contextual: {
    id: "comparacao_contextual",
    label: "Comparação contextual",
    operacaoCognitiva: "Comparação e contextualização",
    diagnosticoAbstrato:
      "Dificuldade em comparar casos, períodos ou perspectivas e tirar conclusões válidas.",
    diagnosticoHumano:
      "Comparar situações, épocas ou pontos de vista e fechar uma conclusão coerente ainda custa.",
    proximoPassoSemana:
      "Monte um quadro de 2 colunas (semelhança / diferença) em 3 questões de Humanas.",
    verboTreino: "treinar quadros comparativos (causa, efeito, limite)",
  },
  inferencia_logica: {
    id: "inferencia_logica",
    label: "Inferência lógica",
    operacaoCognitiva: "Raciocínio lógico e dedução",
    diagnosticoAbstrato:
      "Quebras no encadeamento lógico entre premissas e conclusão exigidas pela questão.",
    diagnosticoHumano:
      "O raciocínio começa bem, mas o encadeamento até a conclusão quebra no meio.",
    proximoPassoSemana:
      "Em 5 questões, escreva ao lado: premissa → passo → conclusão, antes de marcar.",
    verboTreino: "explicitar cada passo do raciocínio por escrito",
  },
  aplicacao_conceitual: {
    id: "aplicacao_conceitual",
    label: "Aplicação em contexto",
    operacaoCognitiva: "Aplicação prática",
    diagnosticoAbstrato:
      "Dificuldade em aplicar conceito estudado em situação nova ou interdisciplinar.",
    diagnosticoHumano:
      "O conceito em si você conhece, mas em contexto novo ou misturado com outra matéria escapa.",
    proximoPassoSemana:
      "Busque 10 questões do mesmo tema em enunciados diferentes (não só um modelo de prova).",
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

/** Mantido para agregação interna; textos na Home vêm de narrativa-copiloto */
export function padraoMetacognitivoCluster(
  causa: ErrorType | null,
  _pct: number | null
): string | null {
  if (!causa) return null;
  return CAUSA_HUMANA_INTERNO[causa] ?? null;
}

const CAUSA_HUMANA_INTERNO: Partial<Record<ErrorType, string>> = {
  CONCEITO_TEORICO: "recuperação de teoria na hora da questão",
  INTERPRETACAO_ENUNCIADO: "leitura do comando",
  CALCULO_BOBEIRA: "execução da conta",
  FALTA_TEMPO: "gestão de tempo",
  CHUTE_TOTAL: "insegurança no conteúdo",
  DUVIDA_CRUCIAL: "dúvida não fechada antes da prova",
};
