/**
 * Diagnóstico Inicial da Jornada — marco zero imutável (Etapa 2).
 * docs/MOTOR-JORNADA-DIAGNOSTICO.md §3.3
 */
import type { ErrorType, ModoUsoRegistro } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import type { StructuredAnamneseProfile } from "@/lib/anamnese-types";
import { parseClassificacaoN1 } from "@/lib/classificacao-n1-types";
import { escopoN2Real } from "@/lib/classificacao-n2-types";
import { indexGlobalEscopos } from "@/lib/conhecimento-catalog/load";
import {
  buildEscopoScores,
  type AnamneseContext,
} from "@/lib/diagnosis-escopo";
import {
  avaliarElegibilidadeJornada,
  coletarMetricasElegibilidadeJornada,
  erroAnalisavel,
  questaoTemN1N2N3,
  unidadeValidaParaJornada,
} from "@/lib/jornada-elegibilidade";
import { pesoBancaParaMeta } from "@/lib/meta-vestibular";
import { pesoModoUso } from "@/lib/modo-uso";
import { mapQuestionAttemptToInput } from "@/lib/question-attempt-input";
import { prisma } from "@/lib/prisma";
import {
  agruparUnidadesJornada,
  PROVA_SELECT_MULTIDIA,
  type UnidadeRegistroJornada,
} from "@/lib/prova-multidia";
import { parseJsonStringArray } from "@/lib/json-snapshot-utils";
import { getMateriaLabel } from "@/lib/taxonomy";

export const JOURNEY_DIAGNOSTIC_VERSAO = "1.0";
export const JOURNEY_DIAGNOSTIC_TIPO_INICIAL = "INICIAL";

export type EstadoEscopoInicial =
  | "SINAL_INICIAL"
  | "FRAGILIDADE"
  | "CRITICO"
  | "MONITORAR";

export type EvidenciasDiagnosticoInicial = {
  versao: typeof JOURNEY_DIAGNOSTIC_VERSAO;
  geradoEm: string;
  provasConsideradas: Array<{
    examId: string;
    provaId?: string | null;
    nome: string;
    banca?: string | null;
    modoUso: string;
    data: string;
    totalQuestoes: number;
    acertos: number;
    erros: number;
  }>;
  totais: {
    provasValidas: number;
    questoesValidas: number;
    acertos: number;
    erros: number;
    pctAcerto: number;
    errosAnalisaveis: number;
    pctQuestoesComN1N2N3: number;
  };
  anamnese: {
    concluida: boolean;
    completedAt?: string | null;
    resumo?: string | null;
    structuredProfileJson?: unknown;
  };
};

export type BaselineEscopoJornada = {
  escopoId: string;
  dominioId?: string | null;
  total: number;
  acertos: number;
  erros: number;
  pctErro: number;
  conhecimentosExigidos: string[];
  conceitosCanonicos: string[];
  tiposErro: Record<string, number>;
  observacoesAluno: string[];
  pesoDiagnostico: number;
  estadoInicial: EstadoEscopoInicial;
  provasComErro: number;
};

export type BaselineJornada = {
  versao: typeof JOURNEY_DIAGNOSTIC_VERSAO;
  criadoEm: string;
  porN1: Array<{
    n1: string;
    total: number;
    acertos: number;
    erros: number;
    pctAcerto: number;
  }>;
  porEscopo: BaselineEscopoJornada[];
  padroesCognitivos: Array<{
    tipo: string;
    ocorrencias: number;
    escoposAssociados: string[];
    interpretacao: string;
  }>;
};

export type DiagnosticoInicialJornada = {
  versao: typeof JOURNEY_DIAGNOSTIC_VERSAO;
  tipo: typeof JOURNEY_DIAGNOSTIC_TIPO_INICIAL;
  resumoExecutivo: string;
  forcas: Array<{
    titulo: string;
    descricao: string;
    evidencias: string[];
    escoposAssociados: string[];
  }>;
  fragilidades: Array<{
    titulo: string;
    descricao: string;
    escopoId?: string;
    n1?: string;
    evidencias: string[];
    tiposErroRelevantes: string[];
  }>;
  escoposCriticos: Array<{
    escopoId: string;
    dominioId?: string | null;
    estado: "CRITICO" | "FRAGILIDADE" | "MONITORAR";
    motivo: string;
    evidencias: string[];
    n3Recorrentes: string[];
    tiposErroRelevantes: string[];
  }>;
  padroesCognitivos: Array<{
    titulo: string;
    descricao: string;
    evidencias: string[];
  }>;
  influenciaAnamnese: {
    resumo: string;
    moduladores: string[];
    limites: string[];
  };
  prioridadesIniciais: Array<{
    ordem: number;
    escopoId?: string;
    n1?: string;
    titulo: string;
    motivo: string;
    tipoPrioridade: "CONTEUDO" | "COGNITIVA" | "MISTA" | "ROTINA";
  }>;
  limitesDaAnalise: string[];
};

export type NarrativaDiagnosticoInicial = {
  titulo: string;
  subtitulo: string;
  mensagemPrincipal: string;
  cards: Array<{
    titulo: string;
    texto: string;
    tipo: "forca" | "fragilidade" | "alerta" | "contexto";
  }>;
  avisoLimite: string;
};

export type DiagnosticoInicialPayload = {
  evidenciasJson: EvidenciasDiagnosticoInicial;
  baselineJson: BaselineJornada;
  diagnosticoJson: DiagnosticoInicialJornada;
  narrativaJson: NarrativaDiagnosticoInicial;
};

export type DiagnosticoInicialResultado = {
  snapshotId: string;
  payload: DiagnosticoInicialPayload;
};

export type DiagnosticoInicialResumo = {
  snapshotId: string;
  criadoEm: string;
  narrativa: NarrativaDiagnosticoInicial;
  evidencias: EvidenciasDiagnosticoInicial;
  diagnostico: DiagnosticoInicialJornada;
};

export type IniciarJornadaComDiagnosticoResult =
  | { ok: true; jaIniciada: boolean; snapshotInicialId: string }
  | { ok: false; error: string; motivosBloqueio?: string[] };

type AttemptColeta = {
  examId: string;
  numero: number;
  correto: boolean;
  n1: string;
  escopoId: string;
  dominioId: string | null;
  conhecimentoExigido: string | null;
  conceitosCanonicos: string[];
  classificacaoConfianca: number | null;
  tipoErro: ErrorType | null;
  observacao: string | null;
  metadadosCognitivosJson: string | null;
  modoUso: ModoUsoRegistro;
  banca: string | null;
};

export type ColetaEvidenciasBruta = {
  geradoEm: Date;
  metaProva: string | null;
  vestibularAlvo: string | null;
  anamnese: {
    concluida: boolean;
    completedAt: Date | null;
    resumo: string | null;
    structuredProfile: StructuredAnamneseProfile | null;
    structuredProfileJson: unknown;
  };
  unidades: UnidadeRegistroJornada[];
  metricas: Awaited<ReturnType<typeof coletarMetricasElegibilidadeJornada>>;
};

type DbClient = Prisma.TransactionClient | typeof prisma;

const TIPOS_ERRO_COGNITIVOS = new Set<string>([
  "CONCEITO_TEORICO",
  "INTERPRETACAO_ENUNCIADO",
  "DUVIDA_CRUCIAL",
  "CHUTE_TOTAL",
  "FALTA_TEMPO",
]);

function parseStructuredProfile(raw: string | null): StructuredAnamneseProfile | null {
  if (!raw?.trim()) return null;
  try {
    return JSON.parse(raw) as StructuredAnamneseProfile;
  } catch {
    return null;
  }
}

function resolverN1(
  pq: {
    classificacaoN1Json?: string | null;
    conhecimentoDominioId?: string | null;
    materia?: string;
  } | null | undefined,
  attempt: {
    conhecimentoDominioId?: string | null;
    materiaId?: string | null;
  }
): string {
  const n1 = parseClassificacaoN1(pq?.classificacaoN1Json);
  return (
    n1?.catalogoId ??
    attempt.conhecimentoDominioId?.split(".")[0] ??
    attempt.materiaId?.trim().toLowerCase() ??
    pq?.materia?.trim().toLowerCase() ??
    "geral"
  );
}

function normalizarAttemptColeta(
  examId: string,
  modoUso: ModoUsoRegistro,
  banca: string | null,
  a: UnidadeRegistroJornada["questionAttempts"][number] & {
    conhecimentoDominioId?: string | null;
    conhecimentoEscopoId?: string | null;
    conhecimentoExigido?: string | null;
    classificacaoConfianca?: number | null;
    conceitosCanonicosJson?: string | null;
    tipoErro?: ErrorType | null;
    observacao?: string | null;
    metadadosCognitivosJson?: string | null;
    materiaId?: string | null;
    provaQuestao?: {
      classificacaoN1Json?: string | null;
      conhecimentoDominioId?: string | null;
      conhecimentoEscopoId?: string | null;
      conhecimentoExigido?: string | null;
      conceitosCanonicosJson?: string | null;
      materia?: string;
    } | null;
  }
): AttemptColeta | null {
  const pq = a.provaQuestao;
  const n1 = resolverN1(pq, a);
  const escopoId = a.conhecimentoEscopoId ?? pq?.conhecimentoEscopoId ?? "";
  const conhecimentoExigido = a.conhecimentoExigido ?? pq?.conhecimentoExigido ?? null;
  const classificacao = {
    n1CatalogoId: n1,
    escopoId,
    conhecimentoExigido,
    correto: a.correto,
  };
  if (!questaoTemN1N2N3(classificacao)) return null;

  const conceitosRaw = a.conceitosCanonicosJson ?? pq?.conceitosCanonicosJson;
  return {
    examId,
    numero: a.numero,
    correto: a.correto,
    n1,
    escopoId,
    dominioId: a.conhecimentoDominioId ?? pq?.conhecimentoDominioId ?? null,
    conhecimentoExigido,
    conceitosCanonicos: parseJsonStringArray(conceitosRaw),
    classificacaoConfianca: a.classificacaoConfianca ?? null,
    tipoErro: (a.tipoErro as ErrorType | null) ?? null,
    observacao: a.observacao ?? null,
    metadadosCognitivosJson: a.metadadosCognitivosJson ?? null,
    modoUso,
    banca,
  };
}

export async function coletarEvidenciasBrutasJornada(
  userId: string,
  db: DbClient = prisma
): Promise<ColetaEvidenciasBruta> {
  const [user, anamnese, exams, metricas] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { metaProva: true, vestibularAlvo: true },
    }),
    db.studentAnamnesis.findUnique({
      where: { userId },
      select: {
        status: true,
        summary: true,
        structuredProfileJson: true,
        completedAt: true,
      },
    }),
    db.exam.findMany({
      where: { userId },
      include: {
        questionAttempts: {
          include: { provaQuestao: true },
        },
        prova: { select: PROVA_SELECT_MULTIDIA },
      },
      orderBy: { data: "asc" },
    }),
    coletarMetricasElegibilidadeJornada(userId),
  ]);

  const profile = parseStructuredProfile(anamnese?.structuredProfileJson ?? null);

  return {
    geradoEm: new Date(),
    metaProva: user?.metaProva ?? null,
    vestibularAlvo: user?.vestibularAlvo ?? null,
    anamnese: {
      concluida: anamnese?.status === "COMPLETED",
      completedAt: anamnese?.completedAt ?? null,
      resumo: anamnese?.summary ?? null,
      structuredProfile: profile,
      structuredProfileJson: profile ?? null,
    },
    unidades: agruparUnidadesJornada(exams).filter(unidadeValidaParaJornada),
    metricas,
  };
}

function anamneseParaContexto(profile: StructuredAnamneseProfile | null): AnamneseContext | undefined {
  if (!profile) return undefined;
  return {
    resumo: null,
    padroesDeclarados: profile.declaredPatterns,
    materiasFracas: profile.academicSelfPerception?.perceivedWeakSubjects,
    materiasFortes: profile.academicSelfPerception?.perceivedStrongSubjects,
    fadigaProvaLonga: profile.examBehavior?.fatigueInLongExams,
    ansiedade: profile.examBehavior?.anxietyOrBlanking,
    maturidadeMetacognitiva: profile.metacognition?.metacognitiveMaturity,
    confianca: profile.emotionalContext?.confidenceLevel,
    bloqueio: profile.academicSelfPerception?.mainDeclaredBlocker,
  };
}

function calcularEstadoEscopo(
  erros: number,
  provasComErro: number,
  pctErro: number,
  confiancaBaixa: boolean
): EstadoEscopoInicial {
  if (confiancaBaixa || erros === 0) return "MONITORAR";
  if (erros >= 3 && provasComErro >= 2) return "CRITICO";
  if (erros >= 2 || (erros >= 1 && pctErro >= 0.6)) return "FRAGILIDADE";
  if (erros === 1) return "SINAL_INICIAL";
  return "MONITORAR";
}

function calcularPesoDiagnosticoEscopo(opts: {
  erros: number;
  provasComErro: number;
  modoUsoMedio: number;
  bancaPesoMedio: number;
  tiposErroRecorrentes: number;
  n3Distintos: number;
}): number {
  const bonusN3 = opts.n3Distintos >= 2 ? 2 : opts.n3Distintos >= 1 ? 1 : 0;
  const bonusTipo = opts.tiposErroRecorrentes >= 2 ? 2 : opts.tiposErroRecorrentes === 1 ? 1 : 0;
  return (
    opts.erros * 2 +
    opts.provasComErro * 3 +
    opts.modoUsoMedio +
    opts.bancaPesoMedio +
    bonusTipo +
    bonusN3
  );
}

/** Monta payload completo — função pura testável a partir da coleta. */
export function montarDiagnosticoInicialPayload(coleta: ColetaEvidenciasBruta): DiagnosticoInicialPayload {
  const escoposIndex = indexGlobalEscopos();
  const attempts: AttemptColeta[] = [];

  for (const unidade of coleta.unidades) {
    const examId = unidade.examIds[0] ?? unidade.id;
    for (const qa of unidade.questionAttempts) {
      const row = normalizarAttemptColeta(examId, unidade.modoUso, unidade.banca, qa);
      if (row) attempts.push(row);
    }
  }

  const provasConsideradas = coleta.unidades.map((u) => {
    const examId = u.examIds[0] ?? u.id;
    const qs = u.questionAttempts;
    const acertos = qs.filter((q) => q.correto).length;
    return {
      examId,
      provaId: u.provaId,
      nome: u.nome,
      banca: u.banca,
      modoUso: u.modoUso,
      data: u.data.toISOString(),
      totalQuestoes: qs.length,
      acertos,
      erros: qs.length - acertos,
    };
  });

  let acertos = 0;
  let erros = 0;
  let errosAnalisaveis = 0;
  for (const a of attempts) {
    if (a.correto) acertos++;
    else {
      erros++;
      if (
        erroAnalisavel({
          correto: false,
          n1CatalogoId: a.n1,
          escopoId: a.escopoId,
          conhecimentoExigido: a.conhecimentoExigido,
        })
      ) {
        errosAnalisaveis++;
      }
    }
  }

  const evidenciasJson: EvidenciasDiagnosticoInicial = {
    versao: JOURNEY_DIAGNOSTIC_VERSAO,
    geradoEm: coleta.geradoEm.toISOString(),
    provasConsideradas,
    totais: {
      provasValidas: provasConsideradas.length,
      questoesValidas: attempts.length,
      acertos,
      erros,
      pctAcerto: attempts.length > 0 ? Math.round((acertos / attempts.length) * 100) : 0,
      errosAnalisaveis,
      pctQuestoesComN1N2N3: coleta.metricas.pctQuestoesComN1N2N3,
    },
    anamnese: {
      concluida: coleta.anamnese.concluida,
      completedAt: coleta.anamnese.completedAt?.toISOString() ?? null,
      resumo: coleta.anamnese.resumo,
      structuredProfileJson: coleta.anamnese.structuredProfileJson,
    },
  };

  const porN1Map = new Map<string, { total: number; acertos: number; erros: number }>();
  for (const a of attempts) {
    const cur = porN1Map.get(a.n1) ?? { total: 0, acertos: 0, erros: 0 };
    cur.total++;
    if (a.correto) cur.acertos++;
    else cur.erros++;
    porN1Map.set(a.n1, cur);
  }

  const porN1 = [...porN1Map.entries()].map(([n1, v]) => ({
    n1,
    total: v.total,
    acertos: v.acertos,
    erros: v.erros,
    pctAcerto: v.total > 0 ? Math.round((v.acertos / v.total) * 100) : 0,
  }));

  type EscopoAcc = {
    escopoId: string;
    dominioId: string | null;
    total: number;
    acertos: number;
    erros: number;
    examIdsErro: Set<string>;
    conhecimentosExigidos: string[];
    conceitosCanonicos: Set<string>;
    tiposErro: Map<string, number>;
    observacoes: string[];
    confiancas: number[];
    pesosModo: number[];
    pesosBanca: number[];
  };

  const escopoMap = new Map<string, EscopoAcc>();
  for (const a of attempts) {
    if (!escopoN2Real(a.escopoId)) continue;
    let acc = escopoMap.get(a.escopoId);
    if (!acc) {
      acc = {
        escopoId: a.escopoId,
        dominioId: a.dominioId,
        total: 0,
        acertos: 0,
        erros: 0,
        examIdsErro: new Set(),
        conhecimentosExigidos: [],
        conceitosCanonicos: new Set(),
        tiposErro: new Map(),
        observacoes: [],
        confiancas: [],
        pesosModo: [],
        pesosBanca: [],
      };
      escopoMap.set(a.escopoId, acc);
    }
    acc.total++;
    acc.pesosModo.push(pesoModoUso(a.modoUso));
    acc.pesosBanca.push(
      pesoBancaParaMeta(a.banca, coleta.metaProva, coleta.vestibularAlvo)
    );
    if (a.classificacaoConfianca != null) acc.confiancas.push(a.classificacaoConfianca);
    if (a.correto) {
      acc.acertos++;
    } else {
      acc.erros++;
      acc.examIdsErro.add(a.examId);
      if (a.conhecimentoExigido) acc.conhecimentosExigidos.push(a.conhecimentoExigido);
      a.conceitosCanonicos.forEach((c) => acc!.conceitosCanonicos.add(c));
      if (a.tipoErro) acc.tiposErro.set(a.tipoErro, (acc.tiposErro.get(a.tipoErro) ?? 0) + 1);
      if (a.observacao?.trim()) acc.observacoes.push(a.observacao.trim());
    }
  }

  const porEscopo: BaselineEscopoJornada[] = [...escopoMap.values()].map((acc) => {
    const pctErro = acc.total > 0 ? acc.erros / acc.total : 0;
    const confiancaBaixa =
      acc.confiancas.length > 0 &&
      acc.confiancas.reduce((s, v) => s + v, 0) / acc.confiancas.length < 0.55;
    const provasComErro = acc.examIdsErro.size;
    const tiposErroRecorrentes = [...acc.tiposErro.values()].filter((n) => n >= 2).length;
    const n3Distintos = new Set(acc.conhecimentosExigidos).size;
    const pesoDiagnostico = calcularPesoDiagnosticoEscopo({
      erros: acc.erros,
      provasComErro,
      modoUsoMedio: acc.pesosModo.reduce((s, v) => s + v, 0) / Math.max(1, acc.pesosModo.length),
      bancaPesoMedio: acc.pesosBanca.reduce((s, v) => s + v, 0) / Math.max(1, acc.pesosBanca.length),
      tiposErroRecorrentes,
      n3Distintos,
    });
    let estadoInicial = calcularEstadoEscopo(acc.erros, provasComErro, pctErro, confiancaBaixa);
    if (pesoDiagnostico >= 14 && estadoInicial !== "SINAL_INICIAL") estadoInicial = "CRITICO";

    return {
      escopoId: acc.escopoId,
      dominioId: acc.dominioId,
      total: acc.total,
      acertos: acc.acertos,
      erros: acc.erros,
      pctErro: Math.round(pctErro * 100),
      conhecimentosExigidos: [...new Set(acc.conhecimentosExigidos)].slice(0, 8),
      conceitosCanonicos: [...acc.conceitosCanonicos].slice(0, 8),
      tiposErro: Object.fromEntries(acc.tiposErro),
      observacoesAluno: [...new Set(acc.observacoes)].slice(0, 5),
      pesoDiagnostico: Math.round(pesoDiagnostico * 10) / 10,
      estadoInicial,
      provasComErro,
    };
  });

  const padroesCognitivosMap = new Map<string, { ocorrencias: number; escopos: Set<string> }>();
  for (const a of attempts) {
    if (a.correto || !a.tipoErro) continue;
    const cur = padroesCognitivosMap.get(a.tipoErro) ?? { ocorrencias: 0, escopos: new Set() };
    cur.ocorrencias++;
    cur.escopos.add(a.escopoId);
    padroesCognitivosMap.set(a.tipoErro, cur);
  }

  const interpretacaoTipo = (tipo: string): string => {
    const map: Record<string, string> = {
      CONCEITO_TEORICO: "Lacuna conceitual recorrente nas questões erradas.",
      INTERPRETACAO_ENUNCIADO: "Dificuldade em traduzir o enunciado em estratégia de resolução.",
      DUVIDA_CRUCIAL: "Dúvida em ponto decisivo da questão.",
      CHUTE_TOTAL: "Respostas sem modelo claro — chute ou insegurança.",
      FALTA_TEMPO: "Pressão de tempo associada aos erros.",
      CALCULO_BOBEIRA: "Erros de execução/cálculo após modelo montado.",
    };
    return map[tipo] ?? "Padrão de erro observado nas provas consideradas.";
  };

  const baselineJson: BaselineJornada = {
    versao: JOURNEY_DIAGNOSTIC_VERSAO,
    criadoEm: coleta.geradoEm.toISOString(),
    porN1,
    porEscopo: porEscopo.sort((a, b) => b.pesoDiagnostico - a.pesoDiagnostico),
    padroesCognitivos: [...padroesCognitivosMap.entries()]
      .sort((a, b) => b[1].ocorrencias - a[1].ocorrencias)
      .map(([tipo, v]) => ({
        tipo,
        ocorrencias: v.ocorrencias,
        escoposAssociados: [...v.escopos].slice(0, 6),
        interpretacao: interpretacaoTipo(tipo),
      })),
  };

  const attemptInputs = coleta.unidades.flatMap((u) =>
    u.questionAttempts.map((qa) => mapQuestionAttemptToInput(qa))
  );

  const escopoScores = buildEscopoScores(attemptInputs, [], {
    anamnese: anamneseParaContexto(coleta.anamnese.structuredProfile),
  });

  const escoposCriticos = porEscopo
    .filter((e) => e.estadoInicial === "CRITICO" || e.estadoInicial === "FRAGILIDADE")
    .slice(0, 8)
    .map((e) => {
      const label = escoposIndex.get(e.escopoId)?.label ?? e.escopoId;
      const tipos = Object.keys(e.tiposErro);
      return {
        escopoId: e.escopoId,
        dominioId: e.dominioId,
        estado: e.estadoInicial === "CRITICO" ? ("CRITICO" as const) : ("FRAGILIDADE" as const),
        motivo:
          e.provasComErro >= 2
            ? `${label} reapareceu em ${e.provasComErro} provas com ${e.erros} erro(s).`
            : `${e.erros} erro(s) em ${label} na amostra inicial.`,
        evidencias: [
          `${e.erros} erro(s) de ${e.total} questões neste escopo`,
          ...(e.provasComErro >= 2 ? [`Recorrência em ${e.provasComErro} provas`] : []),
        ],
        n3Recorrentes: e.conhecimentosExigidos.slice(0, 4),
        tiposErroRelevantes: tipos,
      };
    });

  const forcasN1 = porN1
    .filter((n) => n.total >= 5 && n.pctAcerto >= 65)
    .sort((a, b) => b.pctAcerto - a.pctAcerto)
    .slice(0, 3);

  const forcas = forcasN1.map((n) => ({
    titulo: getMateriaLabel(n.n1) || n.n1,
    descricao: `${n.pctAcerto}% de acerto em ${n.total} questões de ${getMateriaLabel(n.n1) || n.n1} nas provas consideradas.`,
    evidencias: [`${n.acertos} acertos em ${n.total} questões`],
    escoposAssociados: porEscopo
      .filter((e) => e.escopoId.startsWith(n.n1) && e.pctErro < 40)
      .slice(0, 3)
      .map((e) => e.escopoId),
  }));

  const fragilidades = escoposCriticos.slice(0, 6).map((e) => {
    const label = escoposIndex.get(e.escopoId)?.label ?? e.escopoId;
    return {
      titulo: label,
      descricao: e.motivo,
      escopoId: e.escopoId,
      n1: e.escopoId.split(".")[0],
      evidencias: e.evidencias,
      tiposErroRelevantes: e.tiposErroRelevantes,
    };
  });

  const padroesCognitivosDiag = baselineJson.padroesCognitivos
    .filter((p) => p.ocorrencias >= 2)
    .slice(0, 5)
    .map((p) => ({
      titulo: p.tipo.replace(/_/g, " ").toLowerCase(),
      descricao: p.interpretacao,
      evidencias: [`${p.ocorrencias} ocorrências em ${p.escoposAssociados.length} escopo(s)`],
    }));

  const moduladores: string[] = [];
  const limites: string[] = [];
  const profile = coleta.anamnese.structuredProfile;
  if (profile?.routine?.consistencyLevel === "BAIXA") {
    moduladores.push("Rotina de estudo com consistência baixa — prioridades iniciais devem ser poucas.");
  }
  if (profile?.examBehavior?.anxietyOrBlanking) {
    moduladores.push("Ansiedade ou branco em prova relatados na anamnese — considerar ritmo e volume.");
  }
  if (profile?.academicSelfPerception?.perceivedWeakSubjects?.length) {
    limites.push(
      "Matérias percebidas como fracas na anamnese só entram como fragilidade quando confirmadas por erros nas provas."
    );
  }
  limites.push(
    `Diagnóstico baseado em ${provasConsideradas.length} prova(s)/simulado(s) e ${attempts.length} questões válidas — padrões podem mudar com novas evidências.`
  );

  const prioridadesIniciais = porEscopo
    .filter((e) => e.erros > 0 && e.estadoInicial !== "MONITORAR")
    .slice(0, 6)
    .map((e, i) => {
      const label = escoposIndex.get(e.escopoId)?.label ?? e.escopoId;
      const tipoErroDom = Object.entries(e.tiposErro).sort((a, b) => b[1] - a[1])[0]?.[0];
      const tipoPrioridade: "CONTEUDO" | "COGNITIVA" | "MISTA" | "ROTINA" =
        tipoErroDom && TIPOS_ERRO_COGNITIVOS.has(tipoErroDom) && tipoErroDom !== "CONCEITO_TEORICO"
          ? "COGNITIVA"
          : moduladores.length > 0 && i === 0
            ? "MISTA"
            : "CONTEUDO";
      return {
        ordem: i + 1,
        escopoId: e.escopoId,
        n1: e.escopoId.split(".")[0],
        titulo: label,
        motivo:
          e.provasComErro >= 2
            ? `Recorrência em ${e.provasComErro} provas e ${e.erros} erro(s) analisáveis.`
            : `${e.erros} erro(s) com classificação N2/N3 completa.`,
        tipoPrioridade,
      };
    });

  if (prioridadesIniciais.length === 0 && escopoScores[0]) {
    const top = escopoScores[0];
    prioridadesIniciais.push({
      ordem: 1,
      escopoId: top.escopoId,
      n1: top.materiaId,
      titulo: top.escopoLabel,
      motivo: `${top.erros} erro(s) no escopo com maior pressão na amostra.`,
      tipoPrioridade: "CONTEUDO",
    });
  }

  const resumoExecutivo =
    `Com base em ${provasConsideradas.length} prova(s) e ${attempts.length} questões válidas, ` +
    `seu ponto de partida na Jornada mostra ${escoposCriticos.length} escopo(s) que pedem atenção ` +
    `e ${forcas.length} área(s) com desempenho mais sólido na amostra inicial.`;

  const diagnosticoJson: DiagnosticoInicialJornada = {
    versao: JOURNEY_DIAGNOSTIC_VERSAO,
    tipo: JOURNEY_DIAGNOSTIC_TIPO_INICIAL,
    resumoExecutivo,
    forcas,
    fragilidades,
    escoposCriticos,
    padroesCognitivos: padroesCognitivosDiag,
    influenciaAnamnese: {
      resumo:
        coleta.anamnese.resumo?.slice(0, 280) ??
        (coleta.anamnese.concluida
          ? "Anamnese concluída — contexto pessoal modula prioridades, sem substituir evidências das provas."
          : "Sem anamnese detalhada no snapshot."),
      moduladores,
      limites,
    },
    prioridadesIniciais: prioridadesIniciais.slice(0, 5),
    limitesDaAnalise: limites,
  };

  const narrativaJson: NarrativaDiagnosticoInicial = {
    titulo: "Diagnóstico Inicial da Jornada",
    subtitulo: `Marco zero — ${provasConsideradas.length} prova(s) consideradas`,
    mensagemPrincipal: resumoExecutivo,
    cards: [
      ...forcas.slice(0, 2).map((f) => ({
        titulo: f.titulo,
        texto: f.descricao,
        tipo: "forca" as const,
      })),
      ...fragilidades.slice(0, 2).map((f) => ({
        titulo: f.titulo,
        texto: f.descricao,
        tipo: "fragilidade" as const,
      })),
      ...(moduladores.length
        ? [{ titulo: "Contexto da anamnese", texto: moduladores[0]!, tipo: "contexto" as const }]
        : []),
    ],
    avisoLimite:
      "Este é o marco zero da sua Jornada — não será sobrescrito. O plano semanal e as quests da Semana 1 virão na próxima etapa.",
  };

  return { evidenciasJson, baselineJson, diagnosticoJson, narrativaJson };
}

export function resolverAcaoIniciarJornada(state: {
  elegivel: boolean;
  snapshotInicialId: string | null;
  jornadaIniciadaEm: Date | null;
  modoRecuperacao: boolean;
}): "bloquear" | "retornar_existente" | "criar" | "recuperar" {
  if (state.snapshotInicialId) return "retornar_existente";
  if (!state.modoRecuperacao && !state.elegivel) return "bloquear";
  if (state.modoRecuperacao || state.jornadaIniciadaEm) return "recuperar";
  return "criar";
}

export async function buscarSnapshotInicialJornada(userId: string) {
  return prisma.journeyDiagnosticSnapshot.findFirst({
    where: { userId, tipo: JOURNEY_DIAGNOSTIC_TIPO_INICIAL },
    orderBy: { createdAt: "asc" },
  });
}

export async function buscarDiagnosticoInicialJornada(
  userId: string
): Promise<DiagnosticoInicialResumo | null> {
  const snap = await buscarSnapshotInicialJornada(userId);
  if (!snap) return null;
  return parseDiagnosticoInicialResumo(snap);
}

function parseDiagnosticoInicialResumo(snap: {
  id: string;
  createdAt: Date;
  evidenciasJson: string;
  diagnosticoJson: string;
  narrativaJson: string | null;
}): DiagnosticoInicialResumo {
  return {
    snapshotId: snap.id,
    criadoEm: snap.createdAt.toISOString(),
    evidencias: JSON.parse(snap.evidenciasJson) as EvidenciasDiagnosticoInicial,
    diagnostico: JSON.parse(snap.diagnosticoJson) as DiagnosticoInicialJornada,
    narrativa: snap.narrativaJson
      ? (JSON.parse(snap.narrativaJson) as NarrativaDiagnosticoInicial)
      : {
          titulo: "Diagnóstico Inicial",
          subtitulo: "",
          mensagemPrincipal: "",
          cards: [],
          avisoLimite: "",
        },
  };
}

export async function gerarDiagnosticoInicialJornada(
  userId: string,
  db: DbClient = prisma
): Promise<DiagnosticoInicialResultado> {
  const coleta = await coletarEvidenciasBrutasJornada(userId, db);
  const payload = montarDiagnosticoInicialPayload(coleta);

  const created = await db.journeyDiagnosticSnapshot.create({
    data: {
      userId,
      tipo: JOURNEY_DIAGNOSTIC_TIPO_INICIAL,
      versao: JOURNEY_DIAGNOSTIC_VERSAO,
      evidenciasJson: JSON.stringify(payload.evidenciasJson),
      diagnosticoJson: JSON.stringify(payload.diagnosticoJson),
      baselineJson: JSON.stringify(payload.baselineJson),
      narrativaJson: JSON.stringify(payload.narrativaJson),
    },
  });

  return { snapshotId: created.id, payload };
}

export async function iniciarJornadaComDiagnosticoInicial(
  userId: string
): Promise<IniciarJornadaComDiagnosticoResult> {
  const [user, snapshotInicial] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { jornadaIniciadaEm: true },
    }),
    buscarSnapshotInicialJornada(userId),
  ]);

  if (snapshotInicial) {
    if (!user?.jornadaIniciadaEm) {
      await prisma.user.update({
        where: { id: userId },
        data: { jornadaIniciadaEm: snapshotInicial.createdAt },
      });
    }
    return {
      ok: true,
      jaIniciada: true,
      snapshotInicialId: snapshotInicial.id,
    };
  }

  const modoRecuperacao = user?.jornadaIniciadaEm != null;
  const elegibilidade = await avaliarElegibilidadeJornada(userId);

  const acao = resolverAcaoIniciarJornada({
    elegivel: elegibilidade.elegivel,
    snapshotInicialId: null,
    jornadaIniciadaEm: user?.jornadaIniciadaEm ?? null,
    modoRecuperacao,
  });

  if (acao === "bloquear") {
    return {
      ok: false,
      error: elegibilidade.motivosBloqueio[0] ?? "Critérios de elegibilidade não atendidos.",
      motivosBloqueio: elegibilidade.motivosBloqueio,
    };
  }

  const snapshotId = await prisma.$transaction(async (tx) => {
    const { snapshotId: id } = await gerarDiagnosticoInicialJornada(userId, tx);
    if (!user?.jornadaIniciadaEm) {
      await tx.user.update({
        where: { id: userId },
        data: { jornadaIniciadaEm: new Date() },
      });
    }
    return id;
  });

  return {
    ok: true,
    jaIniciada: modoRecuperacao,
    snapshotInicialId: snapshotId,
  };
}
