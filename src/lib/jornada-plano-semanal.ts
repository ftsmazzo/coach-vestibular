/**
 * Plano semanal + quests da Jornada — Etapa 4B.
 * docs/MOTOR-PLANO-QUESTS.md
 */
import type { Prisma } from "@/generated/prisma/client";
import type { StructuredAnamneseProfile } from "@/lib/anamnese-types";
import { indexGlobalEscopos } from "@/lib/conhecimento-catalog/load";
import {
  buscarCicloSemana1Jornada,
  parseCicloInicialResumo,
  type BaselineCicloInicial,
  type NarrativaInicioCiclo,
} from "@/lib/jornada-ciclo-inicial";
import {
  buscarSnapshotInicialJornada,
  JOURNEY_DIAGNOSTIC_TIPO_INICIAL,
} from "@/lib/jornada-diagnostico-inicial";
import { jornadaFoiIniciada } from "@/lib/jornada-elegibilidade";
import {
  montarQuestsFromTemplates,
  selecionarTiposQuest,
  type TipoQuestJornada,
} from "@/lib/jornada-quest-templates";
import {
  logRejeicaoQuest,
  validarQuestJornada,
  type FonteDiagnosticoQuestJornada,
  type QuestJornadaDraft,
} from "@/lib/jornada-quest-validador";
import { prisma } from "@/lib/prisma";

export const ESCOPO_JORNADA_SEMANAL = "JORNADA_SEMANAL";
export const FONTE_GERACAO_JORNADA_V1 = "motor-jornada-v1";
export const AVISO_LIMITE_PLANO_JORNADA =
  "Concluir as quests mostra adesão e resposta local à intervenção. A confirmação de evolução global virá em uma nova prova ou simulado completo.";

export type StudyPlanJornadaItems = {
  versao: "1.0";
  origem: "LearningCycle";
  cicloId: string;
  snapshotId?: string;
  foco: {
    titulo: string;
    escopoId?: string | null;
    dominioId?: string | null;
    motivo: string;
  };
  carga: {
    questsTotal: number;
    duracaoTotalEstimadaMin: number;
    intensidade: "LEVE" | "PADRAO" | "FORTE";
    moduladaPorAnamnese: boolean;
  };
  blocos: Array<{
    ordem: number;
    tipo: "REVISAO" | "CONCEITO" | "TREINO" | "METACOGNICAO";
    titulo: string;
    objetivo: string;
    questIds: string[];
  }>;
  limites: string[];
};

export type StudyPlanJornadaNarrative = {
  titulo: string;
  mensagem: string;
  focoDaSemana: string;
  porQueEssePlano: string;
  comoExecutar: string;
  criterioDeFechamentoLocal: string;
  limiteDaInterpretacao: string;
};

export type QuestJornadaResumo = {
  id: string;
  titulo: string;
  descricao: string;
  tipoQuest: string;
  duracaoMin: number;
  criterioConclusao: string;
  motivo: string;
  status: string;
  conhecimentoEscopoId: string | null;
};

export type PlanoSemanalJornadaResumo = {
  planId: string;
  cicloId: string;
  items: StudyPlanJornadaItems;
  narrative: StudyPlanJornadaNarrative;
  quests: QuestJornadaResumo[];
  recoveryMode: boolean;
  createdAt: string;
};

export type GerarPlanoSemanalResultado =
  | {
      ok: true;
      planId: string;
      cicloId: string;
      questIds: string[];
      jaExistia: boolean;
      mensagem: string;
    }
  | { ok: false; error: string };

type DbClient = Prisma.TransactionClient | typeof prisma;

const TIPO_BLOCO: Record<TipoQuestJornada, StudyPlanJornadaItems["blocos"][0]["tipo"]> = {
  REVISAO_ERRO: "REVISAO",
  CONCEITO_BASE: "CONCEITO",
  TREINO_GUIADO: "TREINO",
  METACOGNICAO: "METACOGNICAO",
};

const OBJETIVO_BLOCO: Record<TipoQuestJornada, string> = {
  REVISAO_ERRO: "Transformar erro real em evidência de aprendizagem.",
  CONCEITO_BASE: "Reconstruir base conceitual frágil no escopo.",
  TREINO_GUIADO: "Praticar o escopo com procedimento explícito.",
  METACOGNICAO: "Tornar o padrão de erro visível para você.",
};

export function parseFonteDiagnosticoQuest(
  raw: string | null
): FonteDiagnosticoQuestJornada | null {
  if (!raw) return null;
  try {
    const f = JSON.parse(raw) as FonteDiagnosticoQuestJornada;
    if (f.versao === "1.0" && f.cicloId) return f;
    return null;
  } catch {
    return null;
  }
}

export function isQuestJornadaMotor(q: {
  fonteDiagnosticoJson: string | null;
  cicloId: string | null;
}): boolean {
  if (!q.cicloId) return false;
  const fonte = parseFonteDiagnosticoQuest(q.fonteDiagnosticoJson);
  return (
    fonte != null &&
    (fonte.origem === "LearningCycle" || fonte.origem === "JourneyDiagnosticSnapshot")
  );
}

export async function podeGerarPlanoSemanalJornada(userId: string): Promise<boolean> {
  if (!(await jornadaFoiIniciada(userId))) return false;
  const ciclo = await prisma.learningCycle.findFirst({
    where: { userId, status: "ATIVO" },
    select: { id: true },
  });
  if (!ciclo) return false;
  const snap = await buscarSnapshotInicialJornada(userId);
  return snap?.tipo === JOURNEY_DIAGNOSTIC_TIPO_INICIAL;
}

export function parseStudyPlanJornadaItems(raw: string): StudyPlanJornadaItems | null {
  try {
    const parsed = JSON.parse(raw) as StudyPlanJornadaItems;
    if (parsed.versao !== "1.0" || parsed.origem !== "LearningCycle" || !parsed.cicloId) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function resolverIdempotenciaPlanoSemanal(state: {
  planoExiste: boolean;
  questsMotorCount: number;
}): "retornar" | "criar_plano_apenas" | "criar_completo" {
  if (state.planoExiste && state.questsMotorCount >= 2) return "retornar";
  if (state.questsMotorCount >= 2 && !state.planoExiste) return "criar_plano_apenas";
  return "criar_completo";
}

export async function buscarPlanoSemanalPorCiclo(
  userId: string,
  cicloId: string,
  db: DbClient = prisma
) {
  const planos = await db.studyPlan.findMany({
    where: {
      userId,
      escopo: ESCOPO_JORNADA_SEMANAL,
      fonteGeracao: FONTE_GERACAO_JORNADA_V1,
    },
    orderBy: { createdAt: "desc" },
  });

  for (const plan of planos) {
    const items = parseStudyPlanJornadaItems(plan.itemsJson);
    if (items?.cicloId === cicloId) return plan;
  }
  return null;
}

export async function buscarQuestsJornadaPorCiclo(
  userId: string,
  cicloId: string,
  db: DbClient = prisma
) {
  return db.quest.findMany({
    where: { userId, cicloId },
    orderBy: { createdAt: "asc" },
  });
}

export function questRowParaResumo(q: {
  id: string;
  titulo: string;
  descricao: string | null;
  tipoQuest: string | null;
  duracaoMin: number;
  status: string;
  fonteDiagnosticoJson: string | null;
  conhecimentoEscopoId: string | null;
}): QuestJornadaResumo {
  const fonte = parseFonteDiagnosticoQuest(q.fonteDiagnosticoJson);
  return {
    id: q.id,
    titulo: q.titulo,
    descricao: descricaoQuestSemCriterioDuplicado(q.descricao),
    tipoQuest: q.tipoQuest ?? "TREINO_GUIADO",
    duracaoMin: q.duracaoMin,
    criterioConclusao: fonte?.criterioConclusao ?? "",
    motivo: fonte?.motivo ?? "",
    status: q.status,
    conhecimentoEscopoId: q.conhecimentoEscopoId,
  };
}

export async function buscarResumoPlanoSemanalJornada(
  userId: string
): Promise<PlanoSemanalJornadaResumo | null> {
  const ciclo = await buscarCicloSemana1Jornada(userId);
  if (!ciclo || ciclo.status !== "ATIVO") return null;

  const plan = await buscarPlanoSemanalPorCiclo(userId, ciclo.id);
  const quests = await buscarQuestsJornadaPorCiclo(userId, ciclo.id);
  const questsMotor = quests.filter(isQuestJornadaMotor);

  if (!plan && questsMotor.length === 0) return null;

  let items: StudyPlanJornadaItems;
  let narrative: StudyPlanJornadaNarrative;

  if (plan) {
    items =
      parseStudyPlanJornadaItems(plan.itemsJson) ??
      montarItemsPlaceholder(ciclo.id, questsMotor.map((q) => q.id));
    narrative = plan.narrativeJson
      ? (JSON.parse(plan.narrativeJson) as StudyPlanJornadaNarrative)
      : montarNarrativePlaceholder(items);
  } else {
    items = montarItemsPlaceholder(ciclo.id, questsMotor.map((q) => q.id));
    narrative = montarNarrativePlaceholder(items);
  }

  return {
    planId: plan?.id ?? "",
    cicloId: ciclo.id,
    items,
    narrative,
    quests: questsMotor.map(questRowParaResumo),
    recoveryMode: plan?.recoveryMode ?? false,
    createdAt: (plan?.createdAt ?? ciclo.createdAt).toISOString(),
  };
}

function montarItemsPlaceholder(cicloId: string, questIds: string[]): StudyPlanJornadaItems {
  return {
    versao: "1.0",
    origem: "LearningCycle",
    cicloId,
    foco: { titulo: "Semana 1", motivo: "" },
    carga: {
      questsTotal: questIds.length,
      duracaoTotalEstimadaMin: 0,
      intensidade: "PADRAO",
      moduladaPorAnamnese: false,
    },
    blocos: [],
    limites: [AVISO_LIMITE_PLANO_JORNADA],
  };
}

function montarNarrativePlaceholder(items: StudyPlanJornadaItems): StudyPlanJornadaNarrative {
  return {
    titulo: "Plano da Semana 1",
    mensagem: items.foco.motivo,
    focoDaSemana: items.foco.titulo,
    porQueEssePlano: items.foco.motivo,
    comoExecutar: "Execute uma quest por vez, na ordem sugerida.",
    criterioDeFechamentoLocal: "Concluir as quests desta semana com registro honesto do que fez.",
    limiteDaInterpretacao: AVISO_LIMITE_PLANO_JORNADA,
  };
}

export function resolverQuantidadeQuests(profile: StructuredAnamneseProfile | null): {
  quantidade: number;
  intensidade: "LEVE" | "PADRAO" | "FORTE";
  moduladaPorAnamnese: boolean;
} {
  let quantidade = 3;
  let intensidade: "LEVE" | "PADRAO" | "FORTE" = "PADRAO";
  let modulada = false;

  if (!profile) return { quantidade, intensidade, moduladaPorAnamnese: modulada };

  const rotinaBaixa = profile.routine.consistencyLevel === "BAIXA";
  const cansaco =
    profile.examBehavior.fatigueInLongExams ||
    profile.examBehavior.anxietyOrBlanking ||
    profile.emotionalContext.fearOfNotEnoughTime;
  const horasBaixas =
    profile.routine.studyHoursPerDay &&
    /menos|1h|uma hora|pouco/i.test(profile.routine.studyHoursPerDay);

  if (rotinaBaixa || cansaco || horasBaixas) {
    quantidade = 2;
    intensidade = "LEVE";
    modulada = true;
  }

  const autonomiaAlta =
    profile.routine.consistencyLevel === "ALTA" &&
    profile.metacognition.metacognitiveMaturity === "ALTA" &&
    profile.emotionalContext.confidenceLevel === "ALTA";

  if (autonomiaAlta && !cansaco) {
    quantidade = 4;
    intensidade = "FORTE";
    modulada = true;
  }

  return { quantidade, intensidade, moduladaPorAnamnese: modulada };
}

export function descricaoQuestSemCriterioDuplicado(descricao: string | null): string {
  if (!descricao) return "";
  return descricao
    .replace(/\n\nConcluir quando:\s*[\s\S]+$/, "")
    .replace(/\nConcluir quando:\s*[\s\S]+$/, "")
    .trim();
}

function montarNarrative(
  focoTitulo: string,
  motivo: string,
  narrativaCiclo: NarrativaInicioCiclo,
  carga: StudyPlanJornadaItems["carga"],
  resumoPlano?: string
): StudyPlanJornadaNarrative {
  return {
    titulo: "Plano da Semana 1 da Jornada",
    mensagem:
      resumoPlano ??
      narrativaCiclo.resumoPlano ??
      narrativaCiclo.narrativaSemana ??
      narrativaCiclo.mensagem,
    focoDaSemana: focoTitulo,
    porQueEssePlano:
      narrativaCiclo.motivoDiagnostico ?? motivo ?? narrativaCiclo.porqueEsseFoco,
    comoExecutar: `Execute ${carga.questsTotal} tarefas (~${carga.duracaoTotalEstimadaMin} min no total), uma por vez. Marque como concluída só após cumprir o critério de cada quest.`,
    criterioDeFechamentoLocal:
      "Concluir as quests desta semana registrando o que fez — sem interpretar como domínio global.",
    limiteDaInterpretacao: AVISO_LIMITE_PLANO_JORNADA,
  };
}

function validarOuFallback(
  draft: QuestJornadaDraft,
  foco: { escopoId?: string | null; titulo: string },
  ctx: Parameters<typeof montarQuestsFromTemplates>[0]
): QuestJornadaDraft | null {
  let resultado = validarQuestJornada(draft, foco);
  if (resultado.valida) return draft;

  const fallbackTipo: TipoQuestJornada =
    draft.tipoQuest === "REVISAO_ERRO" ? "TREINO_GUIADO" : "REVISAO_ERRO";
  const fallback = montarQuestsFromTemplates(ctx, [fallbackTipo])[0];
  if (!fallback) {
    logRejeicaoQuest(draft, resultado.motivos);
    return null;
  }

  resultado = validarQuestJornada(fallback, foco);
  if (!resultado.valida) {
    logRejeicaoQuest(fallback, resultado.motivos);
    return null;
  }
  return fallback;
}

function montarItemsFromQuests(
  ciclo: NonNullable<ReturnType<typeof parseCicloInicialResumo>>,
  snapshotId: string,
  quests: Awaited<ReturnType<typeof buscarQuestsJornadaPorCiclo>>,
  baseline: BaselineCicloInicial
): StudyPlanJornadaItems {
  const duracaoTotal = quests.reduce((s, q) => s + q.duracaoMin, 0);
  return {
    versao: "1.0",
    origem: "LearningCycle",
    cicloId: ciclo.cicloId,
    snapshotId,
    foco: {
      titulo: ciclo.baseline.foco.titulo,
      escopoId: ciclo.metaEscopoId,
      dominioId: ciclo.baseline.foco.dominioId,
      motivo: ciclo.baseline.foco.motivo,
    },
    carga: {
      questsTotal: quests.length,
      duracaoTotalEstimadaMin: duracaoTotal,
      intensidade: "PADRAO",
      moduladaPorAnamnese: false,
    },
    blocos: quests.map((q, i) => {
      const tipo = (q.tipoQuest as TipoQuestJornada) ?? "TREINO_GUIADO";
      return {
        ordem: i + 1,
        tipo: TIPO_BLOCO[tipo] ?? "TREINO",
        titulo: q.titulo,
        objetivo: OBJETIVO_BLOCO[tipo] ?? OBJETIVO_BLOCO.TREINO_GUIADO,
        questIds: [q.id],
      };
    }),
    limites: [AVISO_LIMITE_PLANO_JORNADA, baseline.leitura.oQueNaoPodeSerConcluidoAinda],
  };
}

async function executarGeracao(
  userId: string,
  db: DbClient
): Promise<GerarPlanoSemanalResultado> {
  const cicloRow = await db.learningCycle.findFirst({
    where: { userId, status: "ATIVO" },
    orderBy: { createdAt: "asc" },
  });

  if (!cicloRow) {
    return { ok: false, error: "Nenhum ciclo ativo encontrado." };
  }

  const snapshot = await buscarSnapshotInicialJornada(userId);
  if (!snapshot || snapshot.tipo !== JOURNEY_DIAGNOSTIC_TIPO_INICIAL) {
    return { ok: false, error: "Diagnóstico Inicial não encontrado." };
  }

  const cicloResumo = parseCicloInicialResumo(cicloRow);
  if (!cicloResumo) {
    return { ok: false, error: "Ciclo ativo sem baseline válido." };
  }

  const planExistente = await buscarPlanoSemanalPorCiclo(userId, cicloRow.id, db);
  const questsExistentes = await buscarQuestsJornadaPorCiclo(userId, cicloRow.id, db);
  const questsMotor = questsExistentes.filter(isQuestJornadaMotor);

  const acao = resolverIdempotenciaPlanoSemanal({
    planoExiste: Boolean(planExistente),
    questsMotorCount: questsMotor.length,
  });

  if (acao === "retornar" && planExistente) {
    return {
      ok: true,
      planId: planExistente.id,
      cicloId: cicloRow.id,
      questIds: questsMotor.map((q) => q.id),
      jaExistia: true,
      mensagem: "Plano e quests da semana já existem — preservados.",
    };
  }

  if (acao === "criar_plano_apenas") {
    const items = montarItemsFromQuests(
      cicloResumo,
      snapshot.id,
      questsMotor,
      cicloResumo.baseline
    );
    const narrative = montarNarrative(
      cicloResumo.baseline.foco.titulo,
      cicloResumo.baseline.foco.motivo,
      cicloResumo.narrativa,
      items.carga,
      cicloResumo.baseline.leitura.resumoPlano ?? cicloResumo.narrativa.resumoPlano
    );
    const plan = await db.studyPlan.create({
      data: {
        userId,
        escopo: ESCOPO_JORNADA_SEMANAL,
        fonteGeracao: FONTE_GERACAO_JORNADA_V1,
        provaId: null,
        weekStart: cicloRow.startAt,
        itemsJson: JSON.stringify(items),
        narrativeJson: JSON.stringify(narrative),
        recoveryMode: false,
      },
    });
    return {
      ok: true,
      planId: plan.id,
      cicloId: cicloRow.id,
      questIds: questsMotor.map((q) => q.id),
      jaExistia: false,
      mensagem: "Plano semanal vinculado às quests existentes.",
    };
  }

  const anamnese = await db.studentAnamnesis.findUnique({
    where: { userId },
    select: { structuredProfileJson: true },
  });
  let profile: StructuredAnamneseProfile | null = null;
  if (anamnese?.structuredProfileJson) {
    try {
      profile = JSON.parse(anamnese.structuredProfileJson) as StructuredAnamneseProfile;
    } catch {
      profile = null;
    }
  }

  const { quantidade, intensidade, moduladaPorAnamnese } = resolverQuantidadeQuests(profile);
  const baseline = cicloResumo.baseline;
  const escoposIndex = indexGlobalEscopos();
  const escopoId = cicloRow.metaEscopoId ?? baseline.foco.escopoId ?? null;
  const escopoLabel = escopoId
    ? (escoposIndex.get(escopoId)?.escopoLabel ?? baseline.foco.titulo)
    : baseline.foco.titulo;
  const semEscopo = !escopoId?.trim();

  const ctx = {
    cicloId: cicloRow.id,
    snapshotId: snapshot.id,
    escopoId,
    dominioId: cicloRow.metaDominioId ?? baseline.foco.dominioId ?? null,
    escopoLabel,
    motivoFoco: baseline.leitura.motivoSemana ?? baseline.foco.motivo,
    motivoQuest: baseline.leitura.motivoQuest,
    hipotese: baseline.hipotese,
    baseline,
    tiposErro: baseline.evidencias.tiposErro,
    conhecimentosExigidos: baseline.evidencias.conhecimentosExigidos,
    excecaoSemEscopo: semEscopo,
  };

  const tipos = selecionarTiposQuest(baseline.evidencias.tiposErro, quantidade, semEscopo, escopoId);
  const draftsRaw = montarQuestsFromTemplates(ctx, tipos);
  const foco = { escopoId, titulo: escopoLabel };
  const drafts: QuestJornadaDraft[] = [];

  for (const d of draftsRaw) {
    const ok = validarQuestJornada(d, foco);
    if (ok.valida) {
      drafts.push(d);
      continue;
    }
    const fallback = validarOuFallback(d, foco, ctx);
    if (fallback) drafts.push(fallback);
  }

  if (drafts.length < 2) {
    return {
      ok: false,
      error:
        "Não foi possível gerar quests válidas para esta semana sem cair em tarefas genéricas.",
    };
  }

  const questIds: string[] = [];
  for (const d of drafts) {
    const created = await db.quest.create({
      data: {
        userId,
        cicloId: cicloRow.id,
        titulo: d.titulo,
        descricao: d.descricao,
        conhecimentoEscopoId: d.conhecimentoEscopoId,
        conhecimentoDominioId: d.conhecimentoDominioId,
        tipoQuest: d.tipoQuest,
        fonteDiagnosticoJson: JSON.stringify(d.fonteDiagnosticoJson),
        duracaoMin: d.duracaoEstimadaMin ?? 30,
        rewardMsg: "Passo concluído — isso é adesão local, não confirmação global de domínio.",
      },
    });
    questIds.push(created.id);
  }

  const duracaoTotal = drafts.reduce((s, d) => s + (d.duracaoEstimadaMin ?? 30), 0);
  const items: StudyPlanJornadaItems = {
    versao: "1.0",
    origem: "LearningCycle",
    cicloId: cicloRow.id,
    snapshotId: snapshot.id,
    foco: {
      titulo: escopoLabel,
      escopoId,
      dominioId: ctx.dominioId,
      motivo: baseline.foco.motivo,
    },
    carga: {
      questsTotal: drafts.length,
      duracaoTotalEstimadaMin: duracaoTotal,
      intensidade,
      moduladaPorAnamnese,
    },
    blocos: drafts.map((d, i) => ({
      ordem: i + 1,
      tipo: TIPO_BLOCO[d.tipoQuest],
      titulo: d.titulo,
      objetivo: OBJETIVO_BLOCO[d.tipoQuest],
      questIds: [questIds[i]!],
    })),
    limites: [
      AVISO_LIMITE_PLANO_JORNADA,
      baseline.leitura.oQueNaoPodeSerConcluidoAinda,
    ],
  };

  const narrative = montarNarrative(
    escopoLabel,
    baseline.foco.motivo,
    cicloResumo.narrativa,
    items.carga,
    baseline.leitura.resumoPlano ?? cicloResumo.narrativa.resumoPlano
  );

  let planId: string;
  if (planExistente) {
    planId = planExistente.id;
    await db.studyPlan.update({
      where: { id: planExistente.id },
      data: {
        itemsJson: JSON.stringify(items),
        narrativeJson: JSON.stringify(narrative),
        weekStart: cicloRow.startAt,
      },
    });
  } else {
    const plan = await db.studyPlan.create({
      data: {
        userId,
        escopo: ESCOPO_JORNADA_SEMANAL,
        fonteGeracao: FONTE_GERACAO_JORNADA_V1,
        provaId: null,
        weekStart: cicloRow.startAt,
        itemsJson: JSON.stringify(items),
        narrativeJson: JSON.stringify(narrative),
        recoveryMode: false,
      },
    });
    planId = plan.id;
  }

  return {
    ok: true,
    planId,
    cicloId: cicloRow.id,
    questIds,
    jaExistia: false,
    mensagem: `Plano da Semana 1 criado com ${questIds.length} quests.`,
  };
}

export async function gerarOuObterPlanoSemanalJornada(
  userId: string
): Promise<GerarPlanoSemanalResultado> {
  return prisma.$transaction((tx) => executarGeracao(userId, tx));
}
