/**
 * Geração personalizada do copiloto (IA) — narrativa + plano + quests.
 * Roda só na REGENERAÇÃO (clicar "atualizar", nova prova, fim da anamnese),
 * nunca no render. Resultado é gravado; se a IA falhar, retorna null e o
 * chamador usa o motor de template determinístico.
 */
import { prisma } from "@/lib/prisma";
import { responsesComSchema } from "@/lib/openai-responses-client";
import { buildResumoJornada } from "@/lib/jornada";
import { aggregateJourneyLearning, materiasComDadosReais } from "@/lib/jornada-analytics";
import { getAnamneseMotorContext } from "@/lib/anamnese-motor";
import { formatarPassos } from "@/lib/copiloto-passos";
import type { FocoPedagogico } from "@/lib/diagnosis-escopo";
import {
  formatFocosPedagogicosParaPrompt,
  getFocosPedagogicosRecentes,
  metadadosQuestFromFoco,
} from "@/lib/learning-motor-foco";
import { tituloQuestEscopo } from "@/lib/learning-quest-escopo";
import type { BlocoPlano, StudyPlanItem } from "@/lib/study-plan";
import type { CopilotoGerado, CopilotoNarrativa, QuestGerada } from "@/lib/copiloto-ia-types";

type CopilotoInput = {
  aluno: { nome: string; vestibularAlvo: string | null; metaProva: string | null };
  jornada: {
    totalRegistros: number;
    pctAcertoPonderado: number;
    recoveryMode: boolean;
  };
  materiaDeficit: { label: string; pct: number } | null;
  materiasFortes: string[];
  focosPedagogicos: FocoPedagogico[];
  anamnese: {
    resumo: string | null;
    padroesDeclarados: string[];
    materiasFracas: string[];
    materiasFortes: string[];
    fadigaProvaLonga: boolean;
    ansiedade: boolean;
    maturidadeMetacognitiva: string | null;
    confianca: string | null;
    bloqueio: string | null;
  } | null;
};

const BLOCO_VALIDOS: BlocoPlano[] = [
  "contexto",
  "foco_profundo",
  "consolidacao",
  "manutencao",
  "meta",
];

async function buildInput(userId: string): Promise<CopilotoInput> {
  const [resumo, analytics, anamneseCtx, user, focosPedagogicos] = await Promise.all([
    buildResumoJornada(userId),
    aggregateJourneyLearning(userId, "todos"),
    getAnamneseMotorContext(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, vestibularAlvo: true, metaProva: true },
    }),
    getFocosPedagogicosRecentes(userId, 5),
  ]);

  const recoveryMode = resumo.pctAcertoPonderado < 50 && resumo.totalRegistros >= 2;

  const materiasBase = materiasComDadosReais(analytics.materiasMedia, 5);
  const materiaDeficit = materiasBase
    .filter((m) => m.pctAcerto < 55)
    .sort((a, b) => a.pctAcerto - b.pctAcerto)[0];
  const materiaDeficitFmt = materiaDeficit
    ? { label: materiaDeficit.label, pct: materiaDeficit.pctAcerto }
    : null;

  const materiasFortes = materiasBase
    .filter((m) => m.pctAcerto >= 65)
    .map((m) => m.label);

  const profile = anamneseCtx.profile;

  return {
    aluno: {
      nome: (user?.name ?? "").split(/\s+/)[0] || "estudante",
      vestibularAlvo: user?.vestibularAlvo ?? null,
      metaProva: user?.metaProva ?? null,
    },
    jornada: {
      totalRegistros: resumo.totalRegistros,
      pctAcertoPonderado: resumo.pctAcertoPonderado,
      recoveryMode,
    },
    materiaDeficit: materiaDeficitFmt,
    materiasFortes,
    focosPedagogicos,
    anamnese: anamneseCtx.completed
      ? {
          resumo: anamneseCtx.summary,
          padroesDeclarados: profile?.declaredPatterns ?? [],
          materiasFracas: profile?.academicSelfPerception?.perceivedWeakSubjects ?? [],
          materiasFortes: profile?.academicSelfPerception?.perceivedStrongSubjects ?? [],
          fadigaProvaLonga: Boolean(profile?.examBehavior?.fatigueInLongExams),
          ansiedade: Boolean(profile?.examBehavior?.anxietyOrBlanking),
          maturidadeMetacognitiva: profile?.metacognition?.metacognitiveMaturity ?? null,
          confianca: profile?.emotionalContext?.confidenceLevel ?? null,
          bloqueio: profile?.academicSelfPerception?.mainDeclaredBlocker ?? null,
        }
      : null,
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
  linhaAnamnese: string;
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
  name: "copiloto_personalizado",
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
      linhaAnamnese: { type: "string" },
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
    required: ["missao", "diagnostico", "linhaAnamnese", "blocos", "quests"],
  },
} as const;

const SYSTEM = `Você é o copiloto de preparação para vestibular — mentor humano, específico e direto.
Escreve em português do Brasil, sem jargão técnico ("cluster", "recorrência") e SEM soar a relatório.

Você recebe DADOS REAIS do aluno (estatística + anamnese declarada). Sua tarefa: produzir a narrativa da Home, os blocos do plano da semana e as quests práticas — TUDO personalizado para ESTE aluno.

Regras:
- Cite o que é específico dele: matérias reais, % real, o que ele declarou na conversa.
- Use o primeiro nome às vezes, sem exagero.
- NUNCA invente número que não foi dado. Se não há provas registradas, deixe claro que parte da conversa inicial.
- Quests = intervenções cognitivas com passo a passo acionável (não "resolva questões 70-74").
- COERÊNCIA OBRIGATÓRIA: a soma dos duracaoMin das quests deve refletir a carga real da semana; não prometa horas no plano que as quests não cobrem.
- 3 a 5 quests, cada uma 25–50 min. Distribua na semana (ex.: foco principal em 2 sessões + 1 secundária + 1 de matéria).
- Tom calibrado pela confiança/ansiedade declaradas: mais acolhedor se confiança baixa.
- Diferencie hipótese (anamnese) de confirmação (provas): se os dados confirmam o que ele disse, diga; se contradizem, aponte com cuidado.

## FOCOS PEDAGÓGICOS (OBRIGATÓRIO quando listados)

Os focos por escopo N2 já foram calculados pelo motor determinístico (classificação fina + metadados cognitivos).
- Transforme cada foco em linguagem humana e quests acionáveis.
- NUNCA substitua um foco por outro assunto inventado. NUNCA troque disciplina ou escopoId.
- Cada quest deve referenciar o escopoId correspondente quando houver foco mapeável.
- Priorize os focos [alta] antes dos [media].`;

function buildInstrucao(input: CopilotoInput): string {
  const a = input.anamnese;
  return `DADOS DO ALUNO
Nome: ${input.aluno.nome}
Vestibular alvo: ${input.aluno.vestibularAlvo ?? "não informado"}${input.aluno.metaProva ? ` (${input.aluno.metaProva})` : ""}

JORNADA (provas registradas):
- Registros: ${input.jornada.totalRegistros}
- Acerto ponderado: ${input.jornada.totalRegistros > 0 ? `${input.jornada.pctAcertoPonderado}%` : "sem provas ainda"}
- Modo recuperação: ${input.jornada.recoveryMode ? "sim (ritmo leve)" : "não"}

FOCOS PEDAGÓGICOS (escopo N2 — fonte única de decisão):
${formatFocosPedagogicosParaPrompt(input.focosPedagogicos)}
${input.materiaDeficit ? `Matéria com mais espaço de ganho: ${input.materiaDeficit.label} (${input.materiaDeficit.pct}%).` : ""}
${input.materiasFortes.length ? `Matérias sólidas (manter): ${input.materiasFortes.join(", ")}.` : ""}

ANAMNESE (o que o aluno declarou):
${
    a
      ? `- Resumo: ${a.resumo ?? "—"}
- Padrões declarados: ${a.padroesDeclarados.join("; ") || "—"}
- Matérias que sente fracas: ${a.materiasFracas.join(", ") || "—"}
- Matérias que sente fortes: ${a.materiasFortes.join(", ") || "—"}
- Fadiga em prova longa: ${a.fadigaProvaLonga ? "sim" : "não declarado"}
- Ansiedade/branco: ${a.ansiedade ? "sim" : "não declarado"}
- Maturidade para revisar erros: ${a.maturidadeMetacognitiva ?? "—"}
- Confiança: ${a.confianca ?? "—"}
- Principal bloqueio declarado: ${a.bloqueio ?? "—"}`
      : "Aluno ainda não fez a anamnese."
  }

Gere agora a narrativa (missao + diagnostico em camadas), os blocos do plano e as quests — personalizados para ${input.aluno.nome}. Se não há provas, baseie-se na anamnese e deixe explícito que é hipótese inicial.`;
}

function slugMateria(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
}

function resolverFocoQuest(
  focos: FocoPedagogico[],
  materiaLabel: string,
  index = 0
): FocoPedagogico | undefined {
  const norm = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");
  const nm = norm(materiaLabel);
  if (nm) {
    const byMateria = focos.find(
      (f) => norm(f.materiaLabel).includes(nm) || nm.includes(norm(f.materiaLabel))
    );
    if (byMateria) return byMateria;
  }
  return focos[index];
}

function montarGerado(input: CopilotoInput, ia: IAOutput): CopilotoGerado {
  const agora = new Date();
  const geradoEm = agora.toISOString();

  const quests: QuestGerada[] = ia.quests
    .slice(0, 6)
    .map((q, i) => {
      const dur = Math.min(60, Math.max(20, Math.round(q.duracaoMin || 35)));
      const foco = resolverFocoQuest(input.focosPedagogicos, q.materia, i);
      const meta = foco ? metadadosQuestFromFoco(foco) : {};
      return {
        slug: `ia-${i + 1}-${slugMateria(q.materia || q.rotulo || String(i))}`,
        titulo: (foco ? tituloQuestEscopo(foco) : q.titulo.trim()).slice(0, 120),
        descricao: formatarPassos(
          q.passos.filter((p) => p.trim()).slice(0, 8),
          q.porQue.trim(),
          dur
        ),
        duracaoMin: dur,
        ordem: i + 1,
        rotulo: q.rotulo.trim() || (i === 0 ? "Prioridade da semana" : "Esta semana"),
        ...meta,
      };
    })
    .filter((q) => q.titulo.length > 0);

  const totalMin = quests.reduce((s, q) => s + q.duracaoMin, 0);
  const totalHoras = (totalMin / 60).toFixed(1).replace(".0", "");
  const cargaTexto =
    quests.length > 0
      ? `Esta semana: ${quests.length} tarefa${quests.length > 1 ? "s" : ""}, ~${totalMin} min (~${totalHoras}h) no total. Faça uma por dia, na ordem.`
      : "Sem tarefas geradas ainda.";

  const dataLabel = agora.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  const planoItems: StudyPlanItem[] = [];
  let ordem = 1;

  planoItems.push({
    ordem: ordem++,
    titulo: "Sua semana na jornada",
    descricao: `Plano gerado pelo copiloto em ${dataLabel}.\n\n${ia.diagnostico.paragrafo}\n\n${cargaTexto}\n\nPasso a passo em Quests → O que fazer agora.`,
    duracaoMin: 0,
    bloco: "contexto",
    geraQuest: false,
    errosContexto: "jornada",
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
      errosContexto: "jornada",
    });
  }

  planoItems.push({
    ordem: ordem++,
    titulo: "Meta da semana",
    descricao: `${cargaTexto} ${ia.missao.impacto.trim()} Registre uma nova prova para o copiloto recalibrar com seus erros reais.`,
    duracaoMin: 0,
    bloco: "meta",
    geraQuest: false,
    errosContexto: "jornada",
  });

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
    linhaAnamnese: ia.linhaAnamnese.trim() || null,
    geradoEm,
  };

  return {
    fonte: "ia",
    narrativa,
    planoItems,
    quests,
    recoveryMode: input.jornada.recoveryMode,
  };
}

/** Tenta gerar via IA. Retorna null se não houver chave ou se a IA falhar/vier vazia. */
export async function gerarCopilotoIA(userId: string): Promise<CopilotoGerado | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const input = await buildInput(userId);

  // Sem nenhum dado (nem provas nem anamnese) não vale gastar IA.
  if (input.jornada.totalRegistros === 0 && !input.anamnese) return null;

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
    console.error("copiloto-ia falhou, usando template:", e);
    return null;
  }
}
