/**
 * Diagnóstico Inicial da Jornada — marco zero imutável (Etapa 2 + síntese 4D).
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
import {
  calcularPesoDiagnosticoEscopoAprimorado,
  inputEscopoFromBaseline,
  avaliarQualidadeFocoInicial,
} from "@/lib/jornada-foco-inicial";
import {
  cruzarAnamneseComEvidencias,
  montarEscoposCriticosDiagnostico,
  montarForcasDiagnostico,
  montarPadroesCognitivosDiagnostico,
  montarPrioridadesDiagnostico,
  montarResumoExecutivoDiagnostico,
  rotularTipoErro,
} from "@/lib/jornada-diagnostico-sintese";
import { inferirHipotesePedagogicaFoco } from "@/lib/jornada-hipotese-pedagogica";
import { isMicroescopoIngles } from "@/lib/jornada-foco-inicial";
import {
  evidenciaCanonicaFocoDeAgregado,
  processarUnidadesEvidenciaCanonica,
  type UnidadeEvidenciaInput,
} from "@/lib/jornada-evidencia-canonica";
import { pesoBancaParaMeta } from "@/lib/meta-vestibular";
import { pesoModoUso } from "@/lib/modo-uso";
import { mapQuestionAttemptToInput } from "@/lib/question-attempt-input";
import { prisma } from "@/lib/prisma";
import {
  agruparUnidadesJornada,
  PROVA_SELECT_MULTIDIA,
  type ExamParaAgrupamento,
  type UnidadeRegistroJornada,
} from "@/lib/prova-multidia";
import { parseJsonStringArray } from "@/lib/json-snapshot-utils";

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

export const AVISO_DIAGNOSTICO_INICIAL_BETA =
  "Este diagnóstico inicial ainda está em validação. Ele organiza os primeiros sinais das suas provas, mas será refinado antes de orientar decisões mais fortes.";

export type DiagnosticoInicialJornada = {
  versao: typeof JOURNEY_DIAGNOSTIC_VERSAO;
  tipo: typeof JOURNEY_DIAGNOSTIC_TIPO_INICIAL;
  /** Enquanto o motor não for refinado, novos snapshots saem como rascunho/BETA. */
  statusValidacao?: "rascunho" | "validado";
  qualidade?: "BETA" | "FINAL";
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

export function diagnosticoInicialEmValidacao(diag: DiagnosticoInicialJornada): boolean {
  if (diag.qualidade === "FINAL" || diag.statusValidacao === "validado") return false;
  return true;
}

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
  | { ok: true; jaIniciada: boolean; snapshotInicialId: string; cicloInicialId: string }
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

type QuestaoEvidenciaJornada = {
  numero: number;
  correto: boolean;
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
};

type ExamEvidenciaJornada = ExamParaAgrupamento<QuestaoEvidenciaJornada>;
type UnidadeEvidenciaJornada = UnidadeRegistroJornada<ExamEvidenciaJornada>;

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
  unidades: UnidadeEvidenciaJornada[];
  metricas: Awaited<ReturnType<typeof coletarMetricasElegibilidadeJornada>>;
};

type DbClient = Prisma.TransactionClient | typeof prisma;

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
  a: QuestaoEvidenciaJornada
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
    unidades: agruparUnidadesJornada(exams).filter(unidadeValidaParaJornada) as UnidadeEvidenciaJornada[],
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

/** Monta payload completo — função pura testável a partir da coleta. */
export function montarDiagnosticoInicialPayload(coleta: ColetaEvidenciasBruta): DiagnosticoInicialPayload {
  const canonica = processarUnidadesEvidenciaCanonica(
    coleta.unidades as UnidadeEvidenciaInput[]
  );
  const canonPorEscopo = new Map(
    canonica.agregadoPorEscopo.map((e) => [e.escopoId, e])
  );
  const evidenciaPorEscopo = new Map(
    canonica.agregadoPorEscopo.map((e) => [e.escopoId, evidenciaCanonicaFocoDeAgregado(e)])
  );

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

  const porEscopoPreliminar = [...escopoMap.values()].map((acc) => {
    const pctErro = acc.total > 0 ? acc.erros / acc.total : 0;
    const label = escoposIndex.get(acc.escopoId)?.escopoLabel ?? acc.escopoId;
    const provasComErro = acc.examIdsErro.size;
    const tiposErroRecorrentes = [...acc.tiposErro.values()].filter((n) => n >= 2).length;
    const conhecimentosExigidos = [...new Set(acc.conhecimentosExigidos)];
    const n3Distintos = conhecimentosExigidos.length;
    return {
      acc,
      label,
      pctErro,
      provasComErro,
      tiposErroRecorrentes,
      conhecimentosExigidos,
      n3Distintos,
      tiposErro: Object.fromEntries(acc.tiposErro),
    };
  });

  const inputsAlternativas = porEscopoPreliminar.map((row) =>
    inputEscopoFromBaseline(
      {
        escopoId: row.acc.escopoId,
        dominioId: row.acc.dominioId,
        total: row.acc.total,
        acertos: row.acc.acertos,
        erros: row.acc.erros,
        pctErro: Math.round(row.pctErro * 100),
        conhecimentosExigidos: row.conhecimentosExigidos.slice(0, 8),
        conceitosCanonicos: [...row.acc.conceitosCanonicos].slice(0, 8),
        tiposErro: row.tiposErro,
        observacoesAluno: [...new Set(row.acc.observacoes)].slice(0, 5),
        pesoDiagnostico: 0,
        estadoInicial: "MONITORAR" as const,
        provasComErro: row.provasComErro,
      },
      row.label
    )
  );

  const porEscopo: BaselineEscopoJornada[] = porEscopoPreliminar.map((row, i) => {
    const canon = canonPorEscopo.get(row.acc.escopoId);
    const erros = canon?.erros ?? row.acc.erros;
    const total = canon?.total ?? row.acc.total;
    const provasComErro = canon?.provasComErro ?? row.provasComErro;
    const pctErro = total > 0 ? erros / total : row.pctErro;

    const confiancaBaixa =
      row.acc.confiancas.length > 0 &&
      row.acc.confiancas.reduce((s, v) => s + v, 0) / row.acc.confiancas.length < 0.55;
    const pesoDiagnostico = calcularPesoDiagnosticoEscopoAprimorado(
      {
        escopoId: row.acc.escopoId,
        escopoLabel: row.label,
        erros,
        total,
        provasComErro,
        modoUsoMedio:
          row.acc.pesosModo.reduce((s, v) => s + v, 0) / Math.max(1, row.acc.pesosModo.length),
        bancaPesoMedio:
          row.acc.pesosBanca.reduce((s, v) => s + v, 0) / Math.max(1, row.acc.pesosBanca.length),
        tiposErroRecorrentes: row.tiposErroRecorrentes,
        n3Distintos: row.n3Distintos,
        tiposErro: row.tiposErro,
        conhecimentosExigidos: row.conhecimentosExigidos,
      },
      inputsAlternativas
    );
    let estadoInicial = calcularEstadoEscopo(erros, provasComErro, pctErro, confiancaBaixa);
    if (pesoDiagnostico >= 16 && estadoInicial !== "SINAL_INICIAL") estadoInicial = "CRITICO";

    return {
      escopoId: row.acc.escopoId,
      dominioId: row.acc.dominioId,
      total,
      acertos: canon?.acertos ?? row.acc.acertos,
      erros,
      pctErro: Math.round(pctErro * 100),
      conhecimentosExigidos: canon?.n3Recorrentes.slice(0, 8) ?? row.conhecimentosExigidos.slice(0, 8),
      conceitosCanonicos: [...row.acc.conceitosCanonicos].slice(0, 8),
      tiposErro: row.tiposErro,
      observacoesAluno: [...new Set(row.acc.observacoes)].slice(0, 5),
      pesoDiagnostico,
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

  const escoposCriticos = montarEscoposCriticosDiagnostico(
    porEscopo,
    escopoScores,
    inputsAlternativas,
    evidenciaPorEscopo
  );

  const forcas = montarForcasDiagnostico(porEscopo, porN1);

  const fragilidades = escoposCriticos.slice(0, 5).map((e) => {
    const label = escoposIndex.get(e.escopoId)?.escopoLabel ?? e.escopoId;
    return {
      titulo: label,
      descricao: e.motivo,
      escopoId: e.escopoId,
      n1: e.escopoId.split(".")[0],
      evidencias: e.evidencias,
      tiposErroRelevantes: e.tiposErroRelevantes,
    };
  });

  const padroesCognitivosDiag = montarPadroesCognitivosDiagnostico(baselineJson.padroesCognitivos);

  const cruzamentoAnamnese = cruzarAnamneseComEvidencias(
    coleta.anamnese.structuredProfile,
    porEscopo,
    porN1
  );
  const moduladores = cruzamentoAnamnese.moduladores;
  const limites = [
    ...cruzamentoAnamnese.limites,
    `Diagnóstico baseado em ${provasConsideradas.length} prova(s)/simulado(s) e ${attempts.length} questões válidas — padrões podem mudar com novas evidências.`,
  ];

  const prioridadesIniciais = montarPrioridadesDiagnostico(
    porEscopo,
    escopoScores,
    baselineJson.padroesCognitivos,
    moduladores,
    inputsAlternativas,
    evidenciaPorEscopo
  );

  const padraoTop = baselineJson.padroesCognitivos[0];
  const topPrioridade = prioridadesIniciais[0];
  const evidenciaPrioridade = topPrioridade?.escopoId
    ? evidenciaPorEscopo.get(topPrioridade.escopoId)
    : undefined;
  const hipotesePrioridade = evidenciaPrioridade
    ? inferirHipotesePedagogicaFoco(evidenciaPrioridade, topPrioridade!.titulo)
    : undefined;
  const atencaoIngles = prioridadesIniciais.find(
    (p, i) =>
      i > 0 &&
      p.escopoId &&
      isMicroescopoIngles(p.escopoId, p.titulo)
  );
  const atencaoSecundaria = atencaoIngles
    ? `Inglês segue como atenção secundária por recorrência em microtópicos (${atencaoIngles.titulo})`
    : prioridadesIniciais[1] &&
        prioridadesIniciais[1].escopoId &&
        isMicroescopoIngles(prioridadesIniciais[1].escopoId, prioridadesIniciais[1].titulo)
      ? `Inglês segue como atenção secundária por recorrência em microtópicos`
      : undefined;

  const resumoExecutivo = montarResumoExecutivoDiagnostico({
    provas: provasConsideradas.length,
    questoes: attempts.length,
    pctAcerto: evidenciasJson.totais.pctAcerto,
    escoposCriticos,
    prioridades: prioridadesIniciais,
    forcas,
    padraoCognitivoTop: padraoTop
      ? { titulo: rotularTipoErro(padraoTop.tipo), ocorrencias: padraoTop.ocorrencias }
      : undefined,
    moduladoresAnamnese: moduladores,
    confirmacoesAnamnese: cruzamentoAnamnese.confirmacoes,
    evidenciaPrioridade,
    hipotesePrioridade,
    atencaoSecundaria,
  });

  const diagnosticoJson: DiagnosticoInicialJornada = {
    versao: JOURNEY_DIAGNOSTIC_VERSAO,
    tipo: JOURNEY_DIAGNOSTIC_TIPO_INICIAL,
    statusValidacao: "rascunho",
    qualidade: "BETA",
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
      moduladores: [...moduladores, ...cruzamentoAnamnese.confirmacoes],
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
      "Este é o marco zero da sua Jornada — não será sobrescrito automaticamente.",
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
    const { criarOuObterPrimeiroCicloJornada } = await import("@/lib/jornada-ciclo-inicial");
    const ciclo = await criarOuObterPrimeiroCicloJornada(userId, snapshotInicial);
    return {
      ok: true,
      jaIniciada: true,
      snapshotInicialId: snapshotInicial.id,
      cicloInicialId: ciclo.cicloId,
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

  const resultado = await prisma.$transaction(async (tx) => {
    const { snapshotId } = await gerarDiagnosticoInicialJornada(userId, tx);
    if (!user?.jornadaIniciadaEm) {
      await tx.user.update({
        where: { id: userId },
        data: { jornadaIniciadaEm: new Date() },
      });
    }
    const snap = await tx.journeyDiagnosticSnapshot.findUniqueOrThrow({
      where: { id: snapshotId },
    });
    const { criarOuObterPrimeiroCicloJornada } = await import("@/lib/jornada-ciclo-inicial");
    const ciclo = await criarOuObterPrimeiroCicloJornada(userId, snap, tx);
    return { snapshotId, cicloId: ciclo.cicloId };
  });

  return {
    ok: true,
    jaIniciada: modoRecuperacao,
    snapshotInicialId: resultado.snapshotId,
    cicloInicialId: resultado.cicloId,
  };
}
