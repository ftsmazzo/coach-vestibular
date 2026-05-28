/**
 * Anamnese inicial do Copiloto — entrevista guiada (ato único).
 * Extrai contexto humano; persiste inferências estruturadas, não chat infinito.
 */
import { prisma } from "@/lib/prisma";
import { responsesComSchema } from "@/lib/openai-responses-client";
import {
  ANAMNESE_STAGES,
  ANAMNESE_STAGE_LABELS,
  type AnamneseMessage,
  type AnamneseMotorContext,
  type AnamnesePublicView,
  type AnamneseSession,
  type AnamneseStageId,
  type StructuredAnamneseProfile,
} from "@/lib/anamnese-types";

const MAX_TURNS = 12;
const MAX_SESSION_MESSAGES = 24;

const SEED_PERGUNTA: Record<AnamneseStageId, string> = {
  trajetoria:
    "Para eu te conhecer de verdade: você está no ensino médio, em cursinho ou estudando por conta? É seu primeiro ano tentando o vestibular ou já passou por outras tentativas?",
  rotina:
    "Na prática, como é sua rotina? Quantas horas costuma estudar por dia e o que mais atrapalha manter constância?",
  autopercepcao:
    "Quais matérias você sente que carrega melhor — e qual sempre parece te prender, mesmo quando você estuda?",
  comportamento_prova:
    "Em provas longas ou simulados: você começa bem e cai depois, falta tempo, dá branco ou muda resposta por insegurança?",
  metacognicao:
    "Quando você erra uma questão, costuma entender o motivo depois — ou parece tudo aleatório? Você revisa seus erros com algum método?",
  emocional:
    "O que mais pesa emocionalmente na sua preparação agora — medo de não dar tempo, comparação com outros, ou outra coisa?",
  sintese:
    "Antes de eu fechar seu perfil: existe algo importante sobre como você aprende que ainda não falamos?",
};

const SYSTEM_PROMPT = `Você é o Copiloto de preparação para vestibular (tom humano, direto, acolhedor).
Sua ÚNICA função agora: conduzir a ANAMNESE INICIAL do estudante.

REGRAS OBRIGATÓRIAS:
- Uma pergunta por vez (no campo assistantMessage).
- NÃO dê aula, NÃO responda dúvidas de conteúdo, NÃO monte plano de estudos ainda.
- Se a resposta for vaga ("sim", "matemática"), aprofunde com UMA pergunta concreta (advanceStage=false).
- Não seja terapeuta; não prometa aprovação; não culpe o aluno.
- Máximo 2 aprofundamentos por etapa antes de avançar.
- Quando a etapa tiver informação suficiente, advanceStage=true.
- Quando todas as etapas estiverem cobertas OU totalTurns>=11, shouldComplete=true e faça pergunta de fechamento curta OU mensagem de transição para síntese.
- Etapas em ordem: trajetoria → rotina → autopercepcao → comportamento_prova → metacognicao → emocional → sintese.
- Português do Brasil, frases curtas.`;

function parseSession(raw: string | null): AnamneseSession {
  if (!raw) return { messages: [], totalTurns: 0 };
  try {
    const s = JSON.parse(raw) as AnamneseSession;
    return {
      messages: Array.isArray(s.messages) ? s.messages.slice(-MAX_SESSION_MESSAGES) : [],
      totalTurns: typeof s.totalTurns === "number" ? s.totalTurns : 0,
    };
  } catch {
    return { messages: [], totalTurns: 0 };
  }
}

function parseProfile(raw: string | null): StructuredAnamneseProfile | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StructuredAnamneseProfile;
  } catch {
    return null;
  }
}

function stageIndex(stage: string): number {
  const i = ANAMNESE_STAGES.indexOf(stage as AnamneseStageId);
  return i >= 0 ? i : 0;
}

function nextStage(stage: AnamneseStageId): AnamneseStageId | null {
  const i = stageIndex(stage);
  if (i >= ANAMNESE_STAGES.length - 1) return null;
  return ANAMNESE_STAGES[i + 1]!;
}

function progressPct(stage: AnamneseStageId, totalTurns: number): number {
  const base = (stageIndex(stage) / ANAMNESE_STAGES.length) * 85;
  const turnBonus = Math.min(totalTurns, MAX_TURNS) / MAX_TURNS * 15;
  return Math.min(99, Math.round(base + turnBonus));
}

export function toPublicView(row: {
  status: string;
  currentStage: string;
  sessionJson: string | null;
  summary: string | null;
}): AnamnesePublicView {
  const session = parseSession(row.sessionJson);
  const stage = row.currentStage as AnamneseStageId;
  const completed = row.status === "COMPLETED";

  return {
    status: completed ? "COMPLETED" : "IN_PROGRESS",
    currentStage: completed ? null : stage,
    stageLabel: completed ? null : ANAMNESE_STAGE_LABELS[stage] ?? stage,
    progressPct: completed ? 100 : progressPct(stage, session.totalTurns),
    summary: row.summary,
    messages: session.messages,
    canContinue: !completed && session.totalTurns < MAX_TURNS,
  };
}

export async function getAnamneseStatus(userId: string): Promise<AnamnesePublicView> {
  const row = await prisma.studentAnamnesis.findUnique({ where: { userId } });
  if (!row) {
    return {
      status: "NOT_STARTED",
      currentStage: null,
      stageLabel: null,
      progressPct: 0,
      summary: null,
      messages: [],
      canContinue: true,
    };
  }
  return toPublicView(row);
}

export async function getAnamneseMotorContext(userId: string): Promise<AnamneseMotorContext> {
  const row = await prisma.studentAnamnesis.findUnique({ where: { userId } });
  if (!row || row.status !== "COMPLETED") {
    return {
      completed: false,
      summary: null,
      profile: null,
      ponteNarrativa: null,
      focoInicialTitulo: null,
      focoInicialDescricao: null,
    };
  }

  const profile = parseProfile(row.structuredProfileJson);
  const summary = row.summary ?? null;

  return {
    completed: true,
    summary,
    profile,
    ponteNarrativa: montarPonteNarrativa(profile, summary),
    focoInicialTitulo: montarFocoInicialTitulo(profile),
    focoInicialDescricao: montarFocoInicialDescricao(profile, summary),
  };
}

function montarPonteNarrativa(
  profile: StructuredAnamneseProfile | null,
  summary: string | null
): string | null {
  if (!profile && !summary) return null;
  const partes: string[] = [];
  if (profile?.declaredPatterns?.length) {
    partes.push(`Na conversa inicial você comentou que ${profile.declaredPatterns[0]}.`);
  }
  if (profile?.examBehavior?.fatigueInLongExams) {
    partes.push("Também falou em perder clareza em provas longas.");
  }
  if (profile?.metacognition?.metacognitiveMaturity === "BAIXA") {
    partes.push("Você indicou que ainda não revisa erros com método fixo — vamos trabalhar isso.");
  }
  if (partes.length === 0 && summary) {
    return "Pelo que você contou na conversa inicial com o copiloto, vamos cruzar isso com seus registros de prova.";
  }
  return partes.join(" ");
}

function montarFocoInicialTitulo(profile: StructuredAnamneseProfile | null): string | null {
  const weak = profile?.academicSelfPerception?.perceivedWeakSubjects?.[0];
  if (profile?.examBehavior?.fatigueInLongExams) {
    return "Manter clareza em prova longa";
  }
  if (profile?.metacognition?.metacognitiveMaturity === "BAIXA") {
    return "Transformar erro em aprendizado";
  }
  if (weak) return `Começar a destravar ${weak}`;
  return "Seu mapa de preparação";
}

function montarFocoInicialDescricao(
  profile: StructuredAnamneseProfile | null,
  summary: string | null
): string | null {
  if (summary) return summary.slice(0, 280);
  const blocker = profile?.academicSelfPerception?.mainDeclaredBlocker;
  if (blocker) return `Você sinalizou que o que mais prende é: ${blocker}. O copiloto vai usar isso até seus registros de prova confirmarem ou ajustarem o foco.`;
  return "Registre suas primeiras atividades quando puder — até lá, siga o passo prático da semana em Quests.";
}

export async function startAnamnese(userId: string): Promise<AnamnesePublicView> {
  const existing = await prisma.studentAnamnesis.findUnique({ where: { userId } });
  if (existing?.status === "COMPLETED") {
    return toPublicView(existing);
  }

  const firstMsg: AnamneseMessage = {
    role: "assistant",
    content:
      "Oi — sou seu copiloto de preparação. Antes de olhar só números, quero te conhecer em poucos minutos. " +
      SEED_PERGUNTA.trajetoria,
    at: new Date().toISOString(),
  };

  const session: AnamneseSession = { messages: [firstMsg], totalTurns: 0 };

  const row = await prisma.studentAnamnesis.upsert({
    where: { userId },
    create: {
      userId,
      status: "IN_PROGRESS",
      currentStage: "trajetoria",
      sessionJson: JSON.stringify(session),
    },
    update: {
      status: "IN_PROGRESS",
      currentStage: "trajetoria",
      sessionJson: JSON.stringify(session),
      structuredProfileJson: null,
      summary: null,
      completedAt: null,
    },
  });

  return toPublicView(row);
}

type TurnAI = {
  assistantMessage: string;
  advanceStage: boolean;
  shouldComplete: boolean;
};

const TURN_SCHEMA = {
  name: "anamnese_turn",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      assistantMessage: { type: "string" },
      advanceStage: { type: "boolean" },
      shouldComplete: { type: "boolean" },
    },
    required: ["assistantMessage", "advanceStage", "shouldComplete"],
  },
} as const;

function fallbackTurn(
  stage: AnamneseStageId,
  userText: string,
  session: AnamneseSession
): TurnAI {
  const curta = userText.trim().length < 25;
  const turnsInStage = session.messages.filter((m) => m.role === "user").length;

  if (curta && turnsInStage < 2) {
    return {
      assistantMessage:
        "Entendi em parte — pode me contar um pouco mais, com um exemplo concreto da sua rotina ou da dificuldade?",
      advanceStage: false,
      shouldComplete: false,
    };
  }

  if (session.totalTurns >= MAX_TURNS - 1) {
    return {
      assistantMessage:
        "Obrigado — já tenho o essencial. Vou montar sua síntese e usar isso para personalizar diagnóstico, plano e tarefas.",
      advanceStage: true,
      shouldComplete: true,
    };
  }

  const prox = nextStage(stage);
  if (!prox) {
    return {
      assistantMessage:
        "Perfeito. Vou fechar seu perfil com o que você compartilhou.",
      advanceStage: true,
      shouldComplete: true,
    };
  }

  return {
    assistantMessage: SEED_PERGUNTA[prox],
    advanceStage: true,
    shouldComplete: false,
  };
}

async function processarTurnoIA(
  stage: AnamneseStageId,
  session: AnamneseSession,
  userText: string
): Promise<TurnAI> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return fallbackTurn(stage, userText, session);

  const historico = session.messages
    .slice(-10)
    .map((m) => `${m.role === "assistant" ? "Copiloto" : "Aluno"}: ${m.content}`)
    .join("\n");

  const instrucao = `Etapa atual: ${stage} (${ANAMNESE_STAGE_LABELS[stage]}).
Total de respostas do aluno até agora: ${session.totalTurns}.
Última resposta do aluno: """${userText}"""

Histórico recente:
${historico}

Gere a próxima pergunta ou confirmação. Se shouldComplete=true, assistantMessage deve ser curta e indicar que vai fechar o perfil (sem síntese longa ainda).`;

  try {
    return await responsesComSchema<TurnAI>({
      instrucao,
      systemPrompt: SYSTEM_PROMPT,
      schema: TURN_SCHEMA,
      content: [],
    });
  } catch {
    return fallbackTurn(stage, userText, session);
  }
}

type ExtractAI = {
  summary: string;
  structuredProfile: StructuredAnamneseProfile;
};

async function extrairPerfilFinal(
  session: AnamneseSession,
  user?: { name: string; vestibularAlvo: string | null }
): Promise<ExtractAI> {
  const base = extrairPerfilHeuristico(session, user);
  const transcript = session.messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n")
    .slice(0, 6000);

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || transcript.length < 20) return base;

  const SUMMARY_SCHEMA = {
    name: "anamnese_summary",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        summary: { type: "string" },
        declaredPatterns: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["summary", "declaredPatterns"],
    },
  } as const;

  try {
    const ai = await responsesComSchema<{ summary: string; declaredPatterns: string[] }>({
      instrucao: `Resuma esta anamnese em 2-4 frases humanas (comece com "Entendi sua jornada.") e liste 2-5 padrões declarados pelo aluno (frases curtas).
Aluno: ${user?.name ?? "estudante"}. Curso: ${user?.vestibularAlvo ?? "não informado"}.
Respostas do aluno:\n${transcript}`,
      systemPrompt: "Só JSON. Não invente fatos não ditos.",
      schema: SUMMARY_SCHEMA,
      content: [],
    });
    return {
      summary: ai.summary,
      structuredProfile: {
        ...base.structuredProfile,
        declaredPatterns: ai.declaredPatterns.length
          ? ai.declaredPatterns
          : base.structuredProfile.declaredPatterns,
      },
    };
  } catch {
    return base;
  }
}

function extrairPerfilHeuristico(
  session: AnamneseSession,
  user?: { name: string; vestibularAlvo: string | null }
): ExtractAI {
  const texto = session.messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join(" ")
    .toLowerCase();

  const fatiga =
    /longa|cansa|fadiga|cai no final|perco clareza|últim/i.test(texto);
  const mat =
    /matemática|mat\b|geometria|física/i.test(texto)
      ? ["Matemática"]
      : [];
  const ansiedade = /ansiedade|branco|medo|pressão|tempo/i.test(texto);

  return {
    summary:
      `Entendi sua jornada, ${user?.name?.split(" ")[0] ?? ""}. ` +
      `Vou usar o que você contou para personalizar diagnósticos e tarefas` +
      (user?.vestibularAlvo ? ` rumo a ${user.vestibularAlvo}.` : "."),
    structuredProfile: {
      trajectory: { targetCourse: user?.vestibularAlvo ?? undefined },
      routine: {},
      academicSelfPerception: {
        perceivedWeakSubjects: mat,
        mainDeclaredBlocker: mat[0] ? `dificuldade em ${mat[0]}` : undefined,
      },
      examBehavior: {
        fatigueInLongExams: fatiga,
        anxietyOrBlanking: ansiedade,
        timeManagementIssue: /tempo|falta/i.test(texto),
      },
      metacognition: {
        reviewsMistakesRegularly: /reviso|revisar/i.test(texto),
        metacognitiveMaturity: /padrão|aleatório/i.test(texto) ? "BAIXA" : "MEDIA",
      },
      emotionalContext: {
        fearOfNotEnoughTime: /tempo|dar conta/i.test(texto),
        preferredTone: "ACOLHEDOR",
      },
      declaredPatterns: fatiga
        ? ["perde clareza em provas longas"]
        : mat.length
          ? [`trava em ${mat[0]}`]
          : ["ainda construindo autoconhecimento sobre erros"],
    },
  };
}

export async function processAnamneseMessage(
  userId: string,
  userMessage: string
): Promise<{ view: AnamnesePublicView; completed: boolean }> {
  const text = userMessage.trim();
  if (!text) throw new Error("MENSAGEM_VAZIA");

  let row = await prisma.studentAnamnesis.findUnique({ where: { userId } });
  if (!row || row.status !== "IN_PROGRESS") {
    const started = await startAnamnese(userId);
    row = await prisma.studentAnamnesis.findUnique({ where: { userId } });
    if (!row) throw new Error("ANAMNESE_NAO_CRIADA");
    if (started.status === "COMPLETED") {
      return { view: started, completed: true };
    }
  }

  const session = parseSession(row.sessionJson);
  if (session.totalTurns >= MAX_TURNS) {
    return { view: await finalizarAnamnese(userId), completed: true };
  }

  session.messages.push({
    role: "user",
    content: text,
    at: new Date().toISOString(),
  });
  session.totalTurns += 1;

  const stage = row.currentStage as AnamneseStageId;
  const turn = await processarTurnoIA(stage, session, text);

  let newStage = stage;
  if (turn.shouldComplete) {
    session.messages.push({
      role: "assistant",
      content: turn.assistantMessage,
      at: new Date().toISOString(),
    });
    await prisma.studentAnamnesis.update({
      where: { userId },
      data: { sessionJson: JSON.stringify(session), currentStage: "sintese" },
    });
    const view = await finalizarAnamnese(userId);
    return { view, completed: true };
  }

  if (turn.advanceStage) {
    const prox = nextStage(stage);
    if (prox) newStage = prox;
  }

  session.messages.push({
    role: "assistant",
    content: turn.assistantMessage,
    at: new Date().toISOString(),
  });

  await prisma.studentAnamnesis.update({
    where: { userId },
    data: {
      currentStage: newStage,
      sessionJson: JSON.stringify(session),
    },
  });

  const updated = await prisma.studentAnamnesis.findUnique({ where: { userId } });
  return {
    view: toPublicView(updated!),
    completed: false,
  };
}

export async function finalizarAnamnese(userId: string): Promise<AnamnesePublicView> {
  const row = await prisma.studentAnamnesis.findUnique({ where: { userId } });
  if (!row) return getAnamneseStatus(userId);
  if (row.status === "COMPLETED") return toPublicView(row);

  const session = parseSession(row.sessionJson);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, vestibularAlvo: true },
  });

  const extracted = await extrairPerfilFinal(session, user ?? undefined);

  const sinteseMsg: AnamneseMessage = {
    role: "assistant",
    content: extracted.summary,
    at: new Date().toISOString(),
  };
  session.messages.push(sinteseMsg);

  const updated = await prisma.studentAnamnesis.update({
    where: { userId },
    data: {
      status: "COMPLETED",
      currentStage: "sintese",
      summary: extracted.summary,
      structuredProfileJson: JSON.stringify(extracted.structuredProfile),
      sessionJson: JSON.stringify(session),
      completedAt: new Date(),
    },
  });

  const { buildJourneyInsight } = await import("@/lib/journey-insight");
  await buildJourneyInsight(userId);

  return toPublicView(updated);
}
