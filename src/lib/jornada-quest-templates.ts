/**
 * Templates determinísticos de quests da Jornada — docs/MOTOR-PLANO-QUESTS.md §15.
 */
import type { BaselineCicloInicial } from "@/lib/jornada-ciclo-inicial";
import { isEscopoIngles, isMicroescopoIngles } from "@/lib/jornada-foco-inicial";
import type { FonteDiagnosticoQuestJornada, QuestJornadaDraft } from "@/lib/jornada-quest-validador";

export type TipoQuestJornada =
  | "REVISAO_ERRO"
  | "CONCEITO_BASE"
  | "TREINO_GUIADO"
  | "METACOGNICAO";

export type ContextoTemplateQuest = {
  cicloId: string;
  snapshotId: string;
  escopoId: string | null;
  dominioId: string | null;
  escopoLabel: string;
  motivoFoco: string;
  baseline: BaselineCicloInicial;
  tiposErro: Record<string, number>;
  conhecimentosExigidos: string[];
  excecaoSemEscopo?: boolean;
};

const CRITERIOS: Record<TipoQuestJornada, string> = {
  REVISAO_ERRO:
    "Concluir quando tiver refeito as questões indicadas, registrado comando e dado decisivo em cada uma e escrito uma frase sobre o erro principal.",
  CONCEITO_BASE:
    "Concluir quando o resumo tiver 6 a 8 linhas com sinais do enunciado e você tiver listado 3 perguntas que saberia responder sobre o escopo.",
  TREINO_GUIADO:
    "Concluir quando tiver resolvido as questões seguindo o roteiro (comando, dados, regra/conceito antes da resposta) em cada uma.",
  METACOGNICAO:
    "Concluir quando cada erro estiver classificado (conceito, interpretação, cálculo, atenção ou tempo) e você tiver escrito qual categoria predominou e qual atitude testará na próxima.",
};

function tipoErroDominante(tipos: Record<string, number>): string | null {
  const sorted = Object.entries(tipos).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? null;
}

function nQuestoes(ctx: ContextoTemplateQuest): number {
  const erros = ctx.baseline.evidencias.errosNoEscopo;
  if (erros >= 4) return 3;
  if (erros >= 2) return 2;
  return 2;
}

function montarFonte(
  ctx: ContextoTemplateQuest,
  tipoQuest: TipoQuestJornada,
  criterioConclusao: string
): FonteDiagnosticoQuestJornada {
  return {
    versao: "1.0",
    origem: "LearningCycle",
    cicloId: ctx.cicloId,
    snapshotId: ctx.snapshotId,
    escopoId: ctx.escopoId,
    dominioId: ctx.dominioId,
    conhecimentoExigido: ctx.conhecimentosExigidos.slice(0, 3),
    tiposErro: ctx.tiposErro,
    motivo: ctx.motivoFoco,
    criterioConclusao,
    excecaoSemEscopo: ctx.excecaoSemEscopo,
  };
}

function secaoConclusao(criterio: string): string {
  return `\n\nConcluir quando: ${criterio}`;
}

export function templateRevisaoErro(ctx: ContextoTemplateQuest): QuestJornadaDraft {
  if (isEscopoIngles(ctx.escopoId ?? "")) {
    return templateRevisaoErroIngles(ctx);
  }
  const n = nQuestoes(ctx);
  const dominante = tipoErroDominante(ctx.tiposErro);
  let extra = "";
  if (dominante === "INTERPRETACAO_ENUNCIADO") {
    extra = " Marque o comando e os dados decisivos antes de olhar a correção.";
  } else if (dominante === "CALCULO_BOBEIRA") {
    extra = " Confira unidade, sinal e grandeza antes de comparar com o gabarito.";
  }
  const criterio = CRITERIOS.REVISAO_ERRO;
  const corpo = `Refaça ${n} questão(ões) errada(s) do escopo ${ctx.escopoLabel}. Antes de olhar a correção, escreva: qual era o comando da questão, qual dado era decisivo e onde seu raciocínio mudou. Conclua registrando em uma frase o erro principal.${extra}`;
  return {
    cicloId: ctx.cicloId,
    conhecimentoEscopoId: ctx.escopoId,
    conhecimentoDominioId: ctx.dominioId,
    tipoQuest: "REVISAO_ERRO",
    titulo: `Refazer erros em ${ctx.escopoLabel}`,
    descricao: corpo + secaoConclusao(criterio),
    criterioConclusao: criterio,
    duracaoEstimadaMin: 35,
    dificuldade: "MEDIA",
    fonteDiagnosticoJson: montarFonte(ctx, "REVISAO_ERRO", criterio),
  };
}

export function templateConceitoBase(ctx: ContextoTemplateQuest): QuestJornadaDraft {
  if (isEscopoIngles(ctx.escopoId ?? "")) {
    return templateLeituraIngles(ctx);
  }
  const n3 = ctx.conhecimentosExigidos[0];
  const refN3 = n3 ? ` Inclua o conhecimento exigido: ${n3.slice(0, 120)}.` : "";
  const criterio = CRITERIOS.CONCEITO_BASE;
  const corpo = `Escreva um resumo de 6 a 8 linhas sobre ${ctx.escopoLabel}, incluindo quando usar a ideia principal, quais sinais do enunciado indicam esse conteúdo e um exemplo simples.${refN3} Conclua criando 3 perguntas que você deveria saber responder sobre esse escopo.`;
  return {
    cicloId: ctx.cicloId,
    conhecimentoEscopoId: ctx.escopoId,
    conhecimentoDominioId: ctx.dominioId,
    tipoQuest: "CONCEITO_BASE",
    titulo: `Reconstruir base: ${ctx.escopoLabel}`,
    descricao: corpo + secaoConclusao(criterio),
    criterioConclusao: criterio,
    duracaoEstimadaMin: 30,
    dificuldade: "MEDIA",
    fonteDiagnosticoJson: montarFonte(ctx, "CONCEITO_BASE", criterio),
  };
}

/** Quest de leitura orientada para inglês / microescopos gramaticais. */
export function templateLeituraIngles(ctx: ContextoTemplateQuest): QuestJornadaDraft {
  const criterio =
    "Concluir quando tiver refeito as questões de inglês indicadas, grifado as pistas linguísticas em cada uma e registrado qual relação de sentido você ignorou ao comparar com o gabarito.";
  const focoLabel = isMicroescopoIngles(ctx.escopoId ?? "", ctx.escopoLabel)
    ? "preposições, conectores e expressões que mudam o sentido"
    : ctx.escopoLabel;
  const corpo =
    `Refaça as questões de inglês que você errou neste foco. Em cada uma, grife a preposição, conector ou expressão que muda o sentido da frase (${focoLabel}). ` +
    "Ao lado, escreva se ela indica tempo, lugar, causa, direção, meio, contraste ou condição. " +
    "Depois compare sua resposta original com o gabarito e registre qual pista textual você ignorou ou interpretou de outro modo.";
  return {
    cicloId: ctx.cicloId,
    conhecimentoEscopoId: ctx.escopoId,
    conhecimentoDominioId: ctx.dominioId,
    tipoQuest: "CONCEITO_BASE",
    titulo: "Marcar pistas de sentido no texto em inglês",
    descricao: corpo + secaoConclusao(criterio),
    criterioConclusao: criterio,
    duracaoEstimadaMin: 35,
    dificuldade: "MEDIA",
    fonteDiagnosticoJson: montarFonte(ctx, "CONCEITO_BASE", criterio),
  };
}

export function templateRevisaoErroIngles(ctx: ContextoTemplateQuest): QuestJornadaDraft {
  const n = nQuestoes(ctx);
  const criterio = CRITERIOS.REVISAO_ERRO;
  const corpo =
    `Refaça ${n} questão(ões) de inglês que você errou. Antes de ver o gabarito, anote: qual palavra ou expressão mudava o sentido, qual alternativa você marcou e por que ela parecia plausível. ` +
    "Depois compare com o gabarito e escreva qual pista do enunciado você não usou.";
  return {
    cicloId: ctx.cicloId,
    conhecimentoEscopoId: ctx.escopoId,
    conhecimentoDominioId: ctx.dominioId,
    tipoQuest: "REVISAO_ERRO",
    titulo: "Comparar resposta e gabarito em inglês",
    descricao: corpo + secaoConclusao(criterio),
    criterioConclusao: criterio,
    duracaoEstimadaMin: 35,
    dificuldade: "MEDIA",
    fonteDiagnosticoJson: montarFonte(ctx, "REVISAO_ERRO", criterio),
  };
}

export function templateTreinoGuiado(ctx: ContextoTemplateQuest): QuestJornadaDraft {
  const n = Math.min(5, Math.max(3, nQuestoes(ctx) + 1));
  const dominante = tipoErroDominante(ctx.tiposErro);
  let roteiro =
    "marque o comando, liste os dados relevantes, escolha a fórmula/regra/conceito antes de calcular ou responder, e só então marque a alternativa";
  if (dominante === "INTERPRETACAO_ENUNCIADO") {
    roteiro =
      "marque o comando, separe dado relevante de distração, escolha o conceito antes de calcular e só então marque a alternativa";
  } else if (dominante === "CALCULO_BOBEIRA") {
    roteiro =
      "liste unidade e grandeza de cada dado, confira sinal e ordem de magnitude, depois execute o cálculo e marque a alternativa";
  }
  const criterio = CRITERIOS.TREINO_GUIADO;
  const corpo = `Resolva ${n} questões do escopo ${ctx.escopoLabel}. Em cada uma, siga o roteiro: ${roteiro}.`;
  return {
    cicloId: ctx.cicloId,
    conhecimentoEscopoId: ctx.escopoId,
    conhecimentoDominioId: ctx.dominioId,
    tipoQuest: "TREINO_GUIADO",
    titulo: `Treino guiado: ${ctx.escopoLabel}`,
    descricao: corpo + secaoConclusao(criterio),
    criterioConclusao: criterio,
    duracaoEstimadaMin: 40,
    dificuldade: "FORTE",
    fonteDiagnosticoJson: montarFonte(ctx, "TREINO_GUIADO", criterio),
  };
}

export function templateMetacognicao(ctx: ContextoTemplateQuest): QuestJornadaDraft {
  const criterio = CRITERIOS.METACOGNICAO;
  const corpo = `Revise suas respostas no escopo ${ctx.escopoLabel} e classifique cada erro em uma categoria: conceito, interpretação, cálculo, atenção ou tempo. Depois escreva qual categoria mais apareceu e qual atitude você vai testar na próxima resolução.`;
  return {
    cicloId: ctx.cicloId,
    conhecimentoEscopoId: ctx.escopoId,
    conhecimentoDominioId: ctx.dominioId,
    tipoQuest: "METACOGNICAO",
    titulo: `Classificar erros em ${ctx.escopoLabel}`,
    descricao: corpo + secaoConclusao(criterio),
    criterioConclusao: criterio,
    duracaoEstimadaMin: 25,
    dificuldade: "LEVE",
    fonteDiagnosticoJson: montarFonte(ctx, "METACOGNICAO", criterio),
  };
}

/** Quest cognitiva/organização quando não há escopo N2 confiável. */
export function templateOrganizacaoRotina(ctx: ContextoTemplateQuest): QuestJornadaDraft {
  const criterio =
    "Concluir quando tiver registrado 3 blocos de estudo da semana com duração e tema, e escrito qual será o primeiro escopo a revisar quando houver nova prova.";
  const corpo = `Organize sua semana da Jornada: liste 3 blocos de estudo (dia, duração, tema). Escreva como vai registrar erros das próximas provas para alimentar o diagnóstico. Identifique qual matéria ou escopo você revisará primeiro quando surgir nova evidência.`;
  const fonte: FonteDiagnosticoQuestJornada = {
    versao: "1.0",
    origem: "JourneyDiagnosticSnapshot",
    cicloId: ctx.cicloId,
    snapshotId: ctx.snapshotId,
    escopoId: null,
    dominioId: null,
    motivo: ctx.motivoFoco,
    criterioConclusao: criterio,
    excecaoSemEscopo: true,
  };
  return {
    cicloId: ctx.cicloId,
    conhecimentoEscopoId: null,
    conhecimentoDominioId: null,
    tipoQuest: "METACOGNICAO",
    titulo: "Organizar ritmo da Semana 1",
    descricao: corpo + secaoConclusao(criterio),
    criterioConclusao: criterio,
    duracaoEstimadaMin: 20,
    dificuldade: "LEVE",
    fonteDiagnosticoJson: fonte,
  };
}

const BUILDERS: Record<TipoQuestJornada, (ctx: ContextoTemplateQuest) => QuestJornadaDraft> = {
  REVISAO_ERRO: templateRevisaoErro,
  CONCEITO_BASE: templateConceitoBase,
  TREINO_GUIADO: templateTreinoGuiado,
  METACOGNICAO: templateMetacognicao,
};

export function selecionarTiposQuest(
  tiposErro: Record<string, number>,
  quantidade: number,
  semEscopo: boolean,
  escopoId?: string | null
): TipoQuestJornada[] {
  if (semEscopo) {
    const tres: TipoQuestJornada[] = ["METACOGNICAO", "CONCEITO_BASE", "TREINO_GUIADO"];
    const dois: TipoQuestJornada[] = ["METACOGNICAO", "TREINO_GUIADO"];
    return quantidade >= 3 ? tres.slice(0, quantidade) : dois.slice(0, quantidade);
  }

  if (escopoId && isEscopoIngles(escopoId)) {
    const ingles: TipoQuestJornada[] = ["REVISAO_ERRO", "CONCEITO_BASE", "METACOGNICAO"];
    return ingles.slice(0, quantidade);
  }

  const dominante = tipoErroDominante(tiposErro);
  const base: TipoQuestJornada[] = [];

  if (dominante === "CONCEITO_TEORICO" || dominante === "CHUTE_TOTAL") {
    base.push("CONCEITO_BASE", "REVISAO_ERRO", "TREINO_GUIADO");
  } else if (dominante === "INTERPRETACAO_ENUNCIADO") {
    base.push("METACOGNICAO", "TREINO_GUIADO", "REVISAO_ERRO");
  } else if (dominante === "CALCULO_BOBEIRA") {
    base.push("TREINO_GUIADO", "REVISAO_ERRO", "METACOGNICAO");
  } else if (dominante === "FALTA_TEMPO") {
    base.push("METACOGNICAO", "TREINO_GUIADO");
  } else {
    base.push("REVISAO_ERRO", "CONCEITO_BASE", "TREINO_GUIADO");
  }

  if (quantidade >= 4 && !base.includes("METACOGNICAO")) {
    base.push("METACOGNICAO");
  }

  const unicos: TipoQuestJornada[] = [];
  for (const t of base) {
    if (!unicos.includes(t)) unicos.push(t);
    if (unicos.length >= quantidade) break;
  }

  while (unicos.length < quantidade) {
    const next: TipoQuestJornada[] = ["REVISAO_ERRO", "CONCEITO_BASE", "TREINO_GUIADO", "METACOGNICAO"];
    const pick = next.find((t) => !unicos.includes(t));
    if (!pick) break;
    unicos.push(pick);
  }

  return unicos.slice(0, quantidade);
}

export function montarQuestsFromTemplates(
  ctx: ContextoTemplateQuest,
  tipos: TipoQuestJornada[]
): QuestJornadaDraft[] {
  if (ctx.excecaoSemEscopo && tipos.length > 0) {
    const org = templateOrganizacaoRotina(ctx);
    const rest = tipos
      .filter((t) => t !== "METACOGNICAO")
      .slice(0, Math.max(0, tipos.length - 1))
      .map((t) => BUILDERS[t](ctx));
    return [org, ...rest];
  }
  return tipos.map((t) => BUILDERS[t](ctx));
}
