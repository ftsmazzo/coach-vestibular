/**
 * Geração personalizada por PROVA (IA) — diagnóstico + micro-plano + quests
 * específicos de uma prova do catálogo. Isolado da jornada: quests com prefixo
 * [Prova], plano escopo PROVA. Fallback no gerador template se a IA falhar.
 */
import { prisma } from "@/lib/prisma";
import { responsesComSchema } from "@/lib/openai-responses-client";
import { buildDiagnosisForProva, buildDiagnosisForConjunto } from "@/lib/jornada-diagnostico";
import { buildHistoricoProva } from "@/lib/jornada-historico";
import { getMateriaLabel } from "@/lib/taxonomy";
import { formatarPassos } from "@/lib/copiloto-passos";
import { formatFocosPedagogicosParaPrompt } from "@/lib/learning-motor-foco";
import type { FocoPedagogico } from "@/lib/diagnosis-escopo";
import type { BlocoPlano, StudyPlanItem } from "@/lib/study-plan";
import type { CopilotoNarrativa, QuestGerada } from "@/lib/copiloto-ia-types";

export type ProvaGerado = {
  fonte: "ia";
  narrativa: CopilotoNarrativa;
  planoItems: StudyPlanItem[];
  quests: QuestGerada[];
  recoveryMode: boolean;
};

type ProvaInput = {
  prova: { nome: string; banca: string; tipo: string; ano: number | null };
  aluno: { nome: string };
  tentativas: number;
  melhorPct: number | null;
  ultimaPct: number | null;
  evolucao: Array<{ data: string; pct: number }>;
  materias: Array<{ nome: string; pct: number }>;
  focosPedagogicos: FocoPedagogico[];
};

const BLOCO_VALIDOS: BlocoPlano[] = [
  "contexto",
  "foco_profundo",
  "consolidacao",
  "manutencao",
  "meta",
];

async function buildInput(userId: string, provaId: string): Promise<ProvaInput | null> {
  const [historico, diagnosis, user] = await Promise.all([
    buildHistoricoProva(userId, provaId),
    buildDiagnosisForProva(userId, provaId),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
  ]);

  if (!historico || historico.tentativas.length === 0 || !diagnosis) return null;

  const porMateria = new Map<string, { acertos: number; total: number }>();
  for (const s of diagnosis.escopoScores) {
    const m = porMateria.get(s.materiaLabel) ?? { acertos: 0, total: 0 };
    m.total += s.total;
    m.acertos += s.acertos;
    porMateria.set(s.materiaLabel, m);
  }
  const materias = [...porMateria.entries()]
    .map(([nome, m]) => ({
      nome,
      pct: Math.round((m.acertos / Math.max(1, m.total)) * 100),
    }))
    .sort((a, b) => a.pct - b.pct);

  return {
    prova: {
      nome: historico.prova.nome,
      banca: historico.prova.banca,
      tipo: historico.prova.tipo,
      ano: historico.prova.ano ?? null,
    },
    aluno: { nome: (user?.name ?? "").split(/\s+/)[0] || "estudante" },
    tentativas: historico.tentativas.length,
    melhorPct: historico.melhorPct ?? null,
    ultimaPct: historico.ultimaPct ?? null,
    evolucao: historico.evolucao.map((e) => ({ data: e.data, pct: e.taxaAcerto })),
    materias,
    focosPedagogicos: diagnosis.focosPedagogicos,
  };
}

type IAOutput = {
  missao: { titulo: string; descricao: string; impacto: string };
  diagnostico: {
    titulo: string;
    paragrafo: string;
    oQueAcontece: string;
    comoCognitivo: string;
    quandoAparece: string;
    naoSignifica: string;
    caminho: string;
  };
  blocos: Array<{
    titulo: string;
    descricao: string;
    bloco: string;
    duracaoMin: number;
    materiaDestaque: string;
  }>;
  quests: Array<{
    titulo: string;
    porQue: string;
    passos: string[];
    duracaoMin: number;
    rotulo: string;
    materia: string;
  }>;
};

const IA_SCHEMA = {
  name: "prova_personalizada",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      missao: {
        type: "object",
        additionalProperties: false,
        properties: {
          titulo: { type: "string" },
          descricao: { type: "string" },
          impacto: { type: "string" },
        },
        required: ["titulo", "descricao", "impacto"],
      },
      diagnostico: {
        type: "object",
        additionalProperties: false,
        properties: {
          titulo: { type: "string" },
          paragrafo: { type: "string" },
          oQueAcontece: { type: "string" },
          comoCognitivo: { type: "string" },
          quandoAparece: { type: "string" },
          naoSignifica: { type: "string" },
          caminho: { type: "string" },
        },
        required: [
          "titulo",
          "paragrafo",
          "oQueAcontece",
          "comoCognitivo",
          "quandoAparece",
          "naoSignifica",
          "caminho",
        ],
      },
      blocos: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            titulo: { type: "string" },
            descricao: { type: "string" },
            bloco: {
              type: "string",
              enum: ["contexto", "foco_profundo", "consolidacao", "manutencao", "meta"],
            },
            duracaoMin: { type: "number" },
            materiaDestaque: { type: "string" },
          },
          required: ["titulo", "descricao", "bloco", "duracaoMin", "materiaDestaque"],
        },
      },
      quests: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            titulo: { type: "string" },
            porQue: { type: "string" },
            passos: { type: "array", items: { type: "string" } },
            duracaoMin: { type: "number" },
            rotulo: { type: "string" },
            materia: { type: "string" },
          },
          required: ["titulo", "porQue", "passos", "duracaoMin", "rotulo", "materia"],
        },
      },
    },
    required: ["missao", "diagnostico", "blocos", "quests"],
  },
} as const;

const SYSTEM = `Você é o copiloto de preparação para vestibular — mentor humano, específico e direto.
Português do Brasil, sem jargão técnico, sem soar a relatório.

Tarefa: analisar UMA prova específica do catálogo (não a jornada inteira) e produzir diagnóstico + micro-plano + quests SÓ dessa prova, com base nas tentativas do aluno nela.

Regras:
- Fale da banca/prova pelo nome; cite matérias e % reais desta prova.
- Diferencie o desempenho NESTA prova de impressões gerais.
- Se houve mais de uma tentativa, comente a evolução (subiu/caiu) com cuidado.
- Quests = intervenções práticas só para esta prova (estilo da banca, matérias fracas aqui).
- COERÊNCIA: a soma dos duracaoMin das quests deve refletir a carga sugerida; não prometa horas que as quests não cobrem.
- 3 a 5 quests, 25–50 min cada.
- Não invente número que não foi dado.`;

function buildInstrucao(input: ProvaInput): string {
  return `PROVA: ${input.prova.nome} (${input.prova.banca}${input.prova.ano ? `, ${input.prova.ano}` : ""})
Aluno: ${input.aluno.nome}
Tentativas registradas: ${input.tentativas}${input.melhorPct != null ? ` · melhor ${input.melhorPct}%` : ""}${input.ultimaPct != null ? ` · última ${input.ultimaPct}%` : ""}

Evolução por tentativa:
${input.evolucao.length ? input.evolucao.map((e) => `- ${e.data}: ${e.pct}%`).join("\n") : "- (uma tentativa)"}

Desempenho por matéria NESTA prova (pior → melhor):
${input.materias.length ? input.materias.map((m) => `- ${m.nome}: ${m.pct}%`).join("\n") : "- sem dados por matéria"}

FOCOS PEDAGÓGICOS (escopo N2 — NESTA prova):
${formatFocosPedagogicosParaPrompt(input.focosPedagogicos)}

Gere o diagnóstico (missao + diagnostico em camadas), blocos do micro-plano e quests — tudo específico desta prova, para ${input.aluno.nome}.`;
}

function montarGerado(input: ProvaInput, ia: IAOutput): ProvaGerado {
  const agora = new Date();
  const prefix = `[${input.prova.nome.slice(0, 20)}]`;
  const recoveryMode = (input.ultimaPct ?? 100) < 50;

  const quests: QuestGerada[] = ia.quests
    .slice(0, 5)
    .map((q, i) => {
      const dur = Math.min(60, Math.max(20, Math.round(q.duracaoMin || 35)));
      return {
        slug: `prova-${i + 1}`,
        titulo: `${prefix} ${q.titulo.trim()}`.slice(0, 140),
        descricao: formatarPassos(
          q.passos.filter((p) => p.trim()).slice(0, 8),
          q.porQue.trim(),
          dur
        ),
        duracaoMin: dur,
        ordem: i + 1,
        rotulo: q.rotulo.trim() || (i === 0 ? "Prioridade desta prova" : "Desta prova"),
      };
    })
    .filter((q) => q.titulo.length > prefix.length + 1);

  const totalMin = quests.reduce((s, q) => s + q.duracaoMin, 0);
  const totalHoras = (totalMin / 60).toFixed(1).replace(".0", "");
  const carga =
    quests.length > 0
      ? `Carga só desta prova: ${quests.length} tarefa${quests.length > 1 ? "s" : ""}, ~${totalMin} min (~${totalHoras}h).`
      : "Sem tarefas geradas.";

  const dataLabel = agora.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  const planoItems: StudyPlanItem[] = [];
  let ordem = 0;

  planoItems.push({
    ordem: ordem++,
    titulo: `Micro-plano — ${input.prova.nome}`,
    descricao: `Análise gerada em ${dataLabel}, só desta prova (${input.tentativas} tentativa${input.tentativas > 1 ? "s" : ""}). ${ia.diagnostico.paragrafo}\n\n${carga}\n\nNão substitui o plano global da semana.`,
    duracaoMin: 0,
    bloco: "contexto",
    geraQuest: false,
    errosContexto: "prova",
  });

  for (const b of ia.blocos.slice(0, 5)) {
    const bloco: BlocoPlano = BLOCO_VALIDOS.includes(b.bloco as BlocoPlano)
      ? (b.bloco as BlocoPlano)
      : "consolidacao";
    if (bloco === "contexto") continue;
    planoItems.push({
      ordem: ordem++,
      titulo: b.titulo.trim().slice(0, 120),
      descricao: b.descricao.trim(),
      duracaoMin: Math.max(0, Math.round(b.duracaoMin || 0)),
      bloco,
      materiaDestaque: b.materiaDestaque?.trim() || undefined,
      geraQuest: false,
      errosContexto: "prova",
    });
  }

  const narrativa: CopilotoNarrativa = {
    fonte: "ia",
    missaoTitulo: ia.missao.titulo.trim(),
    missaoDescricao: ia.missao.descricao.trim(),
    missaoImpacto: ia.missao.impacto.trim() || null,
    diagnosticoTitulo: ia.diagnostico.titulo.trim(),
    diagnosticoParagrafo: ia.diagnostico.paragrafo.trim(),
    camadas: {
      oQueAcontece: ia.diagnostico.oQueAcontece.trim(),
      comoCognitivo: ia.diagnostico.comoCognitivo.trim(),
      quandoAparece: ia.diagnostico.quandoAparece.trim(),
      naoSignifica: ia.diagnostico.naoSignifica.trim(),
      caminho: ia.diagnostico.caminho.trim(),
    },
    linhaAnamnese: null,
    geradoEm: agora.toISOString(),
  };

  return { fonte: "ia", narrativa, planoItems, quests, recoveryMode };
}

export async function gerarProvaIA(
  userId: string,
  provaId: string
): Promise<ProvaGerado | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const input = await buildInput(userId, provaId);
  if (!input) return null;

  try {
    const ia = await responsesComSchema<IAOutput>({
      instrucao: buildInstrucao(input),
      systemPrompt: SYSTEM,
      schema: IA_SCHEMA,
      content: [],
    });
    if (!ia?.quests?.length || !ia.missao?.titulo) return null;
    return montarGerado(input, ia);
  } catch (e) {
    console.error("prova-ia falhou, usando template:", e);
    return null;
  }
}

/** IA para prova completa dia 1 + dia 2 (180 questões). */
export async function gerarProvaIAConjunto(
  userId: string,
  examIdDia1: string,
  examIdDia2: string,
  nomeConjunto: string
): Promise<ProvaGerado | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const [diagnosis, user, conjunto] = await Promise.all([
    buildDiagnosisForConjunto(userId, examIdDia1, examIdDia2),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    prisma.exam.findFirst({
      where: { id: examIdDia1, userId },
      include: {
        prova: true,
        questionAttempts: { select: { correto: true } },
      },
    }),
  ]);

  if (!diagnosis || !conjunto?.prova) return null;

  const total = conjunto.questionAttempts?.length ?? 0;
  const acertos = conjunto.questionAttempts?.filter((q) => q.correto).length ?? 0;
  const pct = total > 0 ? Math.round((acertos / total) * 100) : null;

  const porMateria = new Map<string, { acertos: number; total: number }>();
  for (const s of diagnosis.escopoScores) {
    const m = porMateria.get(s.materiaLabel) ?? { acertos: 0, total: 0 };
    m.total += s.total;
    m.acertos += s.acertos;
    porMateria.set(s.materiaLabel, m);
  }

  const input: ProvaInput = {
    prova: {
      nome: nomeConjunto,
      banca: conjunto.prova.banca,
      tipo: conjunto.prova.tipo,
      ano: conjunto.prova.ano ?? null,
    },
    aluno: { nome: (user?.name ?? "").split(/\s+/)[0] || "estudante" },
    tentativas: 1,
    melhorPct: pct,
    ultimaPct: pct,
    evolucao: pct != null ? [{ data: "completa", pct }] : [],
    materias: [...porMateria.entries()]
      .map(([nome, m]) => ({
        nome,
        pct: Math.round((m.acertos / Math.max(1, m.total)) * 100),
      }))
      .sort((a, b) => a.pct - b.pct),
    focosPedagogicos: diagnosis.focosPedagogicos,
  };

  try {
    const instrucao =
      buildInstrucao(input) +
      "\n\nIMPORTANTE: esta é a prova COMPLETA (dia 1 + dia 2, ~180 questões). " +
      "O micro-plano e as quests devem considerar o desempenho nas 180 questões, não só um dia.";

    const ia = await responsesComSchema<IAOutput>({
      instrucao,
      systemPrompt: SYSTEM,
      schema: IA_SCHEMA,
      content: [],
    });
    if (!ia?.quests?.length || !ia.missao?.titulo) return null;
    return montarGerado(input, ia);
  } catch (e) {
    console.error("prova-ia conjunto falhou, usando template:", e);
    return null;
  }
}
