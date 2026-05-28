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

/** Limite alto — encerramento é por etapas, não por contador seco */
const MAX_TURNS = 22;
const MIN_TURNS_ANTES_DE_ENCERRAR = 9;
const MAX_SESSION_MESSAGES = 28;
const MAX_APROFUNDAMENTOS_POR_ETAPA = 2;

const SEED_PERGUNTA: Record<AnamneseStageId, string> = {
  trajetoria:
    "Me conta um pouco da sua história com o vestibular: você está no médio, no cursinho ou estudando por conta? Há quanto tempo nessa preparação?",
  rotina:
    "E no dia a dia — quanto tempo consegue estudar além das aulas, e o que mais atrapalha manter o ritmo?",
  autopercepcao:
    "Quais matérias você sente que vai melhor — e quais mais te travam, mesmo quando você estuda?",
  comportamento_prova:
    "Quando faz simulado ou prova longa: você aguenta bem o começo, falta tempo, dá branco ou fica mudando resposta?",
  metacognicao:
    "Depois que erra uma questão, você costuma entender por quê — ou parece tudo misturado? Você revisa seus erros com algum método?",
  emocional:
    "O que mais pesa emocionalmente na preparação agora — pressa, comparação, medo de não dar conta, ou outra coisa?",
  sintese:
    "Pra fechar: tem algo importante sobre como você aprende que ainda não entrou na conversa?",
};

function buildSystemPrompt(primeiroNome: string, vestibularAlvo: string | null): string {
  return `Você é o Copiloto de preparação para vestibular — conversa com ${primeiroNome}${vestibularAlvo ? `, que mira ${vestibularAlvo}` : ""}.

Sua função AGORA: anamnese inicial — conhecer a pessoa, NÃO dar aula nem montar plano.

TOM (obrigatório):
- Humano, natural, brasileiro; como um mentor atento, não formulário nem SDR.
- SEMPRE comece reconhecendo algo concreto que ${primeiroNome} acabou de dizer (1 frase curta e específica).
- Use o primeiro nome de vez em quando, sem exagero.
- PROIBIDO: "Certo.", "Perfeito.", "Entendi." sozinhos; listas de confirmação; repetir pergunta já respondida.
- Se a resposta já trouxe várias informações, NÃO peça de novo — avance ou aprofunde só o que faltou.
- Uma pergunta nova por mensagem (pode vir depois do reconhecimento).
- Não seja terapeuta; não prometa aprovação.

ETAPAS (ordem): trajetoria → rotina → autopercepcao → comportamento_prova → metacognicao → emocional → sintese.
- advanceStage=true só quando a etapa atual tiver informação suficiente (máx. ${MAX_APROFUNDAMENTOS_POR_ETAPA} aprofundamentos se resposta vaga).
- shouldComplete=true APENAS na etapa emocional ou sintese E quando já houver contexto rico nas etapas anteriores; nunca no meio da trajetória ou rotina.`;
}

function parseSession(raw: string | null): AnamneseSession {
  if (!raw) return { messages: [], totalTurns: 0, stageTurns: 0 };
  try {
    const s = JSON.parse(raw) as AnamneseSession;
    return {
      messages: Array.isArray(s.messages) ? s.messages.slice(-MAX_SESSION_MESSAGES) : [],
      totalTurns: typeof s.totalTurns === "number" ? s.totalTurns : 0,
      stageTurns: typeof s.stageTurns === "number" ? s.stageTurns : 0,
    };
  } catch {
    return { messages: [], totalTurns: 0, stageTurns: 0 };
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
  const stageWeight = ((stageIndex(stage) + 1) / ANAMNESE_STAGES.length) * 80;
  const turnWeight = Math.min(totalTurns / MIN_TURNS_ANTES_DE_ENCERRAR, 1) * 20;
  return Math.min(98, Math.round(stageWeight + turnWeight));
}

function primeiroNome(name: string): string {
  const n = name.trim().split(/\s+/)[0];
  return n || "você";
}

function respostasDoAluno(session: AnamneseSession): string {
  return session.messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n• ");
}

function podeEncerrarAnamnese(session: AnamneseSession, stage: AnamneseStageId): boolean {
  if (session.totalTurns < MIN_TURNS_ANTES_DE_ENCERRAR) return false;
  if (stageIndex(stage) < stageIndex("emocional")) return false;
  return true;
}

function respostaPareceVaga(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.length < 12) return true;
  return /^(sim|não|nao|ok|talvez|sei lá|seila|um pouco|mais ou menos)\.?$/i.test(t);
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
    canContinue: !completed,
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
  if (blocker) {
    return `Você sinalizou que o que mais prende é: ${blocker}. O copiloto vai usar isso até seus registros de prova confirmarem ou ajustarem o foco.`;
  }
  return "Registre suas primeiras atividades quando puder — até lá, siga o passo prático da semana em Quests.";
}

function mensagemAbertura(nome: string, vestibularAlvo: string | null): string {
  const alvo = vestibularAlvo ? ` rumo a ${vestibularAlvo}` : "";
  return (
    `Oi, ${nome}! Que bom te ter aqui — sou seu copiloto de preparação${alvo}.\n\n` +
    `Antes de olhar só nota e gráfico, quero te ouvir por alguns minutos: sua história, rotina e como você se sente em prova. ` +
    `Não é bate-papo aberto — são perguntas certeiras, no seu ritmo.\n\n` +
    SEED_PERGUNTA.trajetoria
  );
}

export async function startAnamnese(userId: string): Promise<AnamnesePublicView> {
  const existing = await prisma.studentAnamnesis.findUnique({ where: { userId } });
  if (existing?.status === "COMPLETED") {
    return toPublicView(existing);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, vestibularAlvo: true },
  });
  const nome = primeiroNome(user?.name ?? "");

  const firstMsg: AnamneseMessage = {
    role: "assistant",
    content: mensagemAbertura(nome, user?.vestibularAlvo ?? null),
    at: new Date().toISOString(),
  };

  const session: AnamneseSession = { messages: [firstMsg], totalTurns: 0, stageTurns: 0 };

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

function validarTurno(
  turn: TurnAI,
  stage: AnamneseStageId,
  session: AnamneseSession,
  userText: string
): TurnAI {
  let { assistantMessage, advanceStage, shouldComplete } = turn;

  if (shouldComplete && !podeEncerrarAnamnese(session, stage)) {
    shouldComplete = false;
  }

  if (shouldComplete && stage !== "emocional" && stage !== "sintese") {
    shouldComplete = false;
    advanceStage = true;
  }

  const vaga = respostaPareceVaga(userText);
  if (vaga && session.stageTurns < MAX_APROFUNDAMENTOS_POR_ETAPA) {
    advanceStage = false;
    shouldComplete = false;
  }

  if (advanceStage && session.stageTurns === 0 && vaga) {
    advanceStage = false;
  }

  assistantMessage = assistantMessage.trim();
  if (assistantMessage.length < 20) {
    assistantMessage =
      fallbackTurn(stage, userText, session, "").assistantMessage;
  }

  return { assistantMessage, advanceStage, shouldComplete };
}

function fallbackTurn(
  stage: AnamneseStageId,
  userText: string,
  session: AnamneseSession,
  primeiroNome: string
): TurnAI {
  const vaga = respostaPareceVaga(userText);
  const nome = primeiroNome || "você";

  if (vaga && session.stageTurns < MAX_APROFUNDAMENTOS_POR_ETAPA) {
    return {
      assistantMessage: `${nome}, quero te entender direito — pode me dar um exemplo concreto do que você quis dizer?`,
      advanceStage: false,
      shouldComplete: false,
    };
  }

  if (session.totalTurns >= MAX_TURNS - 1 && podeEncerrarAnamnese(session, stage)) {
    return {
      assistantMessage: `${nome}, já captei o essencial da sua jornada. Vou fechar seu perfil e usar isso pra personalizar tudo por aqui.`,
      advanceStage: true,
      shouldComplete: true,
    };
  }

  const prox = nextStage(stage);
  if (!prox) {
    return {
      assistantMessage: `${nome}, obrigado por abrir isso comigo — vou montar sua síntese agora.`,
      advanceStage: true,
      shouldComplete: true,
    };
  }

  const eco = userText.length > 15 ? userText.slice(0, 80).replace(/\n/g, " ") : "";
  const intro = eco
    ? `Faz sentido — ${eco}${eco.length >= 80 ? "…" : ""}. `
    : `Obrigado por compartilhar, ${nome}. `;

  return {
    assistantMessage: intro + SEED_PERGUNTA[prox],
    advanceStage: true,
    shouldComplete: false,
  };
}

async function processarTurnoIA(
  stage: AnamneseStageId,
  session: AnamneseSession,
  userText: string,
  ctx: { primeiroNome: string; vestibularAlvo: string | null }
): Promise<TurnAI> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return fallbackTurn(stage, userText, session, ctx.primeiroNome);

  const historico = session.messages
    .slice(-14)
    .map((m) => `${m.role === "assistant" ? "Copiloto" : ctx.primeiroNome}: ${m.content}`)
    .join("\n");

  const fatos = respostasDoAluno(session);

  const instrucao = `Etapa atual: ${stage} (${ANAMNESE_STAGE_LABELS[stage]}).
Respostas do aluno até agora (${session.totalTurns}): 
• ${fatos || "(nenhuma ainda)"}

Última mensagem do aluno:
"""${userText}"""

Histórico:
${historico}

Regras deste turno:
- Reconheça algo ESPECÍFICO da última resposta antes de perguntar.
- NÃO repita perguntas sobre fatos já listados acima (ex.: se já disse cursinho/3º ano/Famerp, não pergunte de novo).
- advanceStage=${session.stageTurns >= 1 || !respostaPareceVaga(userText) ? "pode ser true se etapa ok" : "false se ainda falta detalhe"}.
- shouldComplete=${podeEncerrarAnamnese(session, stage) ? "só true se etapa emocional/sintese e conversa rica" : "false"}.`;

  try {
    const raw = await responsesComSchema<TurnAI>({
      instrucao,
      systemPrompt: buildSystemPrompt(ctx.primeiroNome, ctx.vestibularAlvo),
      schema: TURN_SCHEMA,
      content: [],
    });
    return validarTurno(raw, stage, session, userText);
  } catch {
    return fallbackTurn(stage, userText, session, ctx.primeiroNome);
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

  const nome = primeiroNome(user?.name ?? "");

  try {
    const ai = await responsesComSchema<{ summary: string; declaredPatterns: string[] }>({
      instrucao: `Resuma esta anamnese em 2-4 frases calorosas para ${nome} (comece com "Entendi sua jornada, ${nome}."). Tom humano, sem jargão.
Curso: ${user?.vestibularAlvo ?? "não informado"}.
O que o aluno disse:\n${transcript}`,
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
  const mat = /matemática|matematica|mat\b|geometria/i.test(texto)
    ? ["Matemática"]
    : [];
  const ing = /inglês|ingles/i.test(texto);
  const fracos = [...mat, ...(ing ? ["Inglês"] : [])];
  const ansiedade = /ansiedade|branco|medo|pressão|confiança|confianca/i.test(texto);

  const nome = primeiroNome(user?.name ?? "");

  return {
    summary:
      `Entendi sua jornada, ${nome}. ` +
      `Vou usar o que você contou para personalizar diagnósticos e tarefas` +
      (user?.vestibularAlvo ? ` rumo a ${user.vestibularAlvo}.` : "."),
    structuredProfile: {
      trajectory: {
        targetCourse: user?.vestibularAlvo ?? undefined,
        hasTakenPrepCourse: /cursinho/i.test(texto),
      },
      routine: {},
      academicSelfPerception: {
        perceivedWeakSubjects: fracos,
        mainDeclaredBlocker: fracos[0] ? `dificuldade em ${fracos.join(" e ")}` : undefined,
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
        confidenceLevel: /pouca confiança|sem confiança/i.test(texto) ? "BAIXA" : "MEDIA",
        preferredTone: "ACOLHEDOR",
      },
      declaredPatterns: fatiga
        ? ["perde clareza em provas longas"]
        : fracos.length
          ? [`trava em ${fracos.join(" e ")}`]
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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, vestibularAlvo: true },
  });
  const ctx = {
    primeiroNome: primeiroNome(user?.name ?? ""),
    vestibularAlvo: user?.vestibularAlvo ?? null,
  };

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
  session.stageTurns += 1;

  const stage = row.currentStage as AnamneseStageId;
  const turn = await processarTurnoIA(stage, session, text, ctx);

  let newStage = stage;
  if (turn.shouldComplete && podeEncerrarAnamnese(session, stage)) {
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
    if (prox) {
      newStage = prox;
      session.stageTurns = 0;
    }
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
