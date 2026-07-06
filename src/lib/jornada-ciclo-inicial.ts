/**
 * Semana 1 / primeiro LearningCycle — Etapa 3.
 * Nasce do JourneyDiagnosticSnapshot INICIAL; sem StudyPlan, Quest ou CicloQuiz.
 */
import type { Prisma } from "@/generated/prisma/client";
import { indexGlobalEscopos } from "@/lib/conhecimento-catalog/load";
import {
  JOURNEY_DIAGNOSTIC_TIPO_INICIAL,
  type BaselineJornada,
  type DiagnosticoInicialJornada,
  type NarrativaDiagnosticoInicial,
  buscarSnapshotInicialJornada,
} from "@/lib/jornada-diagnostico-inicial";
import { prisma } from "@/lib/prisma";
import { getMateriaLabel } from "@/lib/taxonomy";

const DIAS_CICLO = 7;
const BASELINE_CICLO_VERSAO = "1.0";

export type SnapshotInicialRow = {
  id: string;
  createdAt: Date;
  diagnosticoJson: string;
  baselineJson: string | null;
  narrativaJson: string | null;
};

export type SnapshotInicialParsed = {
  id: string;
  createdAt: Date;
  diagnostico: DiagnosticoInicialJornada;
  baseline: BaselineJornada;
  narrativa: NarrativaDiagnosticoInicial;
};

export type FocoInicialJornada = {
  escopoId: string | null;
  dominioId: string | null;
  titulo: string;
  motivo: string;
  estadoInicial?: string;
  materiaLabel: string | null;
  conceitosCanonicos: string[];
  tiposErro: Record<string, number>;
  padroesCognitivos: Array<{ titulo: string; descricao: string }>;
  origem: "CRITICO" | "FRAGILIDADE" | "MONITORAR" | "PRIORIDADE" | "COGNITIVA" | "ORGANIZACAO";
};

export type BaselineCicloInicial = {
  versao: typeof BASELINE_CICLO_VERSAO;
  origem: "JourneyDiagnosticSnapshot:INICIAL";
  snapshotInicialId: string;
  criadoEm: string;
  foco: {
    escopoId?: string | null;
    dominioId?: string | null;
    titulo: string;
    motivo: string;
    estadoInicial?: string;
  };
  evidencias: {
    totalQuestoesNoEscopo: number;
    acertosNoEscopo: number;
    errosNoEscopo: number;
    pctErro: number;
    provasComErro: number;
    conhecimentosExigidos: string[];
    tiposErro: Record<string, number>;
    observacoesAluno: string[];
  };
  leitura: {
    problemaPrincipal: string;
    hipoteseDiagnostica: string;
    oQueSeraObservadoNaSemana: string;
    oQueNaoPodeSerConcluidoAinda: string;
  };
};

export type NarrativaInicioCiclo = {
  titulo: string;
  subtitulo: string;
  mensagem: string;
  focoPrincipal: string;
  porqueEsseFoco: string;
  comoVamosMedir: string;
  limiteDaSemana: string;
};

export type CicloInicialResumo = {
  cicloId: string;
  indice: number;
  status: string;
  startAt: string;
  endAt: string;
  metaTitulo: string;
  metaEscopoId: string | null;
  metaMateria: string | null;
  baseline: BaselineCicloInicial;
  narrativa: NarrativaInicioCiclo;
};

export type PrimeiroCicloResultado = {
  cicloId: string;
  criado: boolean;
  indice: number;
};

type DbClient = Prisma.TransactionClient | typeof prisma;

export function parseSnapshotInicialRow(row: SnapshotInicialRow): SnapshotInicialParsed {
  return {
    id: row.id,
    createdAt: row.createdAt,
    diagnostico: JSON.parse(row.diagnosticoJson) as DiagnosticoInicialJornada,
    baseline: row.baselineJson
      ? (JSON.parse(row.baselineJson) as BaselineJornada)
      : { versao: "1.0", criadoEm: row.createdAt.toISOString(), porN1: [], porEscopo: [], padroesCognitivos: [] },
    narrativa: row.narrativaJson
      ? (JSON.parse(row.narrativaJson) as NarrativaDiagnosticoInicial)
      : {
          titulo: "Diagnóstico Inicial",
          subtitulo: "",
          mensagemPrincipal: "",
          cards: [],
          avisoLimite: "",
        },
  };
}

export function selecionarFocoInicialDoDiagnostico(
  snapshot: SnapshotInicialParsed
): FocoInicialJornada {
  const { diagnostico, baseline } = snapshot;
  const escoposIndex = indexGlobalEscopos();

  const critico = diagnostico.escoposCriticos.find((e) => e.estado === "CRITICO" && e.escopoId);
  if (critico) {
    return focoFromEscopo(critico.escopoId, critico.motivo, "CRITICO", baseline, escoposIndex, diagnostico);
  }

  const fragil = diagnostico.escoposCriticos.find((e) => e.estado === "FRAGILIDADE" && e.escopoId);
  if (fragil) {
    return focoFromEscopo(fragil.escopoId, fragil.motivo, "FRAGILIDADE", baseline, escoposIndex, diagnostico);
  }

  const prioridadeComEscopo = diagnostico.prioridadesIniciais.find((p) => p.escopoId?.trim());
  if (prioridadeComEscopo?.escopoId) {
    return focoFromEscopo(
      prioridadeComEscopo.escopoId,
      prioridadeComEscopo.motivo,
      "PRIORIDADE",
      baseline,
      escoposIndex,
      diagnostico
    );
  }

  const fragilidade = diagnostico.fragilidades.find((f) => f.escopoId?.trim());
  if (fragilidade?.escopoId) {
    return focoFromEscopo(
      fragilidade.escopoId,
      fragilidade.descricao,
      "FRAGILIDADE",
      baseline,
      escoposIndex,
      diagnostico
    );
  }

  const monitorar = diagnostico.escoposCriticos.find((e) => e.estado === "MONITORAR" && e.escopoId);
  if (monitorar) {
    return focoFromEscopo(monitorar.escopoId, monitorar.motivo, "MONITORAR", baseline, escoposIndex, diagnostico);
  }

  const cognitiva = diagnostico.prioridadesIniciais.find(
    (p) => p.tipoPrioridade === "COGNITIVA" || p.tipoPrioridade === "ROTINA"
  );
  if (cognitiva) {
    const padroes = diagnostico.padroesCognitivos.slice(0, 2).map((p) => ({
      titulo: p.titulo,
      descricao: p.descricao,
    }));
    return {
      escopoId: null,
      dominioId: null,
      titulo: cognitiva.titulo,
      motivo: cognitiva.motivo,
      materiaLabel: cognitiva.n1 ? getMateriaLabel(cognitiva.n1) : null,
      conceitosCanonicos: [],
      tiposErro: {},
      padroesCognitivos: padroes,
      origem: cognitiva.tipoPrioridade === "ROTINA" ? "ORGANIZACAO" : "COGNITIVA",
    };
  }

  return {
    escopoId: null,
    dominioId: null,
    titulo: "Organização inicial da Jornada",
    motivo:
      "Ainda não há escopo com evidência forte o suficiente — a Semana 1 organiza o ritmo antes do foco pedagógico.",
    materiaLabel: null,
    conceitosCanonicos: [],
    tiposErro: {},
    padroesCognitivos: diagnostico.padroesCognitivos.slice(0, 1).map((p) => ({
      titulo: p.titulo,
      descricao: p.descricao,
    })),
    origem: "ORGANIZACAO",
  };
}

function focoFromEscopo(
  escopoId: string,
  motivo: string,
  origem: FocoInicialJornada["origem"],
  baseline: BaselineJornada,
  escoposIndex: ReturnType<typeof indexGlobalEscopos>,
  diagnostico: DiagnosticoInicialJornada
): FocoInicialJornada {
  const entry = escoposIndex.get(escopoId);
  const linhaBaseline = baseline.porEscopo.find((e) => e.escopoId === escopoId);
  const n1 = escopoId.split(".")[0] ?? null;
  const padroesRelacionados = diagnostico.padroesCognitivos.filter((p) =>
    p.evidencias.some((ev) => ev.includes(escopoId) || ev.toLowerCase().includes(entry?.label?.toLowerCase() ?? ""))
  );

  return {
    escopoId,
    dominioId: linhaBaseline?.dominioId ?? entry?.dominioId ?? null,
    titulo: entry?.label ?? escopoId,
    motivo,
    estadoInicial: linhaBaseline?.estadoInicial,
    materiaLabel: n1 ? getMateriaLabel(n1) : null,
    conceitosCanonicos: linhaBaseline?.conceitosCanonicos ?? [],
    tiposErro: linhaBaseline?.tiposErro ?? {},
    padroesCognitivos: padroesRelacionados.slice(0, 2).map((p) => ({
      titulo: p.titulo,
      descricao: p.descricao,
    })),
    origem,
  };
}

export function montarBaselineCicloInicial(
  snapshot: SnapshotInicialParsed,
  foco: FocoInicialJornada
): BaselineCicloInicial {
  const linha = foco.escopoId
    ? snapshot.baseline.porEscopo.find((e) => e.escopoId === foco.escopoId)
    : undefined;

  const tiposErro = linha?.tiposErro ?? foco.tiposErro;
  const tipoDominante = Object.entries(tiposErro).sort((a, b) => b[1] - a[1])[0]?.[0];

  let hipotese = foco.motivo;
  if (tipoDominante === "CONCEITO_TEORICO") {
    hipotese = "Os erros sugerem lacuna conceitual no conteúdo exigido neste escopo.";
  } else if (tipoDominante === "INTERPRETACAO_ENUNCIADO") {
    hipotese = "Os erros sugerem dificuldade em interpretar o comando antes de aplicar o conteúdo.";
  } else if (foco.padroesCognitivos[0]) {
    hipotese = foco.padroesCognitivos[0].descricao;
  }

  return {
    versao: BASELINE_CICLO_VERSAO,
    origem: "JourneyDiagnosticSnapshot:INICIAL",
    snapshotInicialId: snapshot.id,
    criadoEm: new Date().toISOString(),
    foco: {
      escopoId: foco.escopoId,
      dominioId: foco.dominioId,
      titulo: foco.titulo,
      motivo: foco.motivo,
      estadoInicial: foco.estadoInicial,
    },
    evidencias: {
      totalQuestoesNoEscopo: linha?.total ?? 0,
      acertosNoEscopo: linha?.acertos ?? 0,
      errosNoEscopo: linha?.erros ?? 0,
      pctErro: linha?.pctErro ?? 0,
      provasComErro: linha?.provasComErro ?? 0,
      conhecimentosExigidos: linha?.conhecimentosExigidos ?? [],
      tiposErro,
      observacoesAluno: linha?.observacoesAluno ?? [],
    },
    leitura: {
      problemaPrincipal: foco.escopoId
        ? `${foco.titulo} apareceu como prioridade no Diagnóstico Inicial da Jornada.`
        : "A Semana 1 organiza o ritmo e a leitura dos primeiros sinais da Jornada.",
      hipoteseDiagnostica: hipotese,
      oQueSeraObservadoNaSemana: foco.escopoId
        ? "Se o erro está mais ligado a conceito, unidade ou interpretação do comando neste escopo."
        : "Como você organiza estudo e responde aos primeiros focos quando surgirem.",
      oQueNaoPodeSerConcluidoAinda:
        "Domínio consolidado global — a confirmação real virá em uma próxima prova ou simulado completo.",
    },
  };
}

export function montarNarrativaInicioCiclo(
  snapshot: SnapshotInicialParsed,
  foco: FocoInicialJornada
): NarrativaInicioCiclo {
  const focoLabel = foco.titulo;
  const porque =
    foco.motivo ||
    `Este foco foi escolhido a partir das prioridades do seu Diagnóstico Inicial (${snapshot.narrativa.subtitulo}).`;

  return {
    titulo: "Semana 1 da Jornada",
    subtitulo: foco.escopoId ? `Foco: ${focoLabel}` : "Organização inicial",
    mensagem: foco.escopoId
      ? `A Semana 1 vai focar em ${focoLabel} porque esse escopo apareceu como prioridade inicial no seu Diagnóstico da Jornada. Nesta semana, vamos observar se o erro está mais ligado a conceito, unidade ou interpretação do comando. O resultado da semana será um sinal local; a confirmação real virá em uma próxima prova ou simulado completo.`
      : `A Semana 1 organiza seu ritmo na Jornada enquanto consolidamos evidências para um foco pedagógico mais específico. O resultado desta semana será um sinal local, não um diagnóstico definitivo.`,
    focoPrincipal: focoLabel,
    porqueEsseFoco: porque,
    comoVamosMedir: foco.escopoId
      ? `Baseline: ${foco.motivo} Evolução local será observada ao longo da semana; confirmação global exige nova prova.`
      : "Aderência ao ritmo proposto e clareza sobre o próximo foco pedagógico.",
    limiteDaSemana:
      "Semana 1 ainda não possui plano nem quests gerados — isso virá na próxima etapa.",
  };
}

export function resolverAcaoCicloInicial(state: {
  temSnapshotInicial: boolean;
  cicloAtivoId: string | null;
  cicloIndice1Id: string | null;
}): "bloquear" | "retornar_ativo" | "retornar_indice1" | "criar" {
  if (!state.temSnapshotInicial) return "bloquear";
  if (state.cicloAtivoId) return "retornar_ativo";
  if (state.cicloIndice1Id) return "retornar_indice1";
  return "criar";
}

export async function buscarCicloSemana1Jornada(userId: string) {
  const ativo = await prisma.learningCycle.findFirst({
    where: { userId, status: "ATIVO" },
    orderBy: { createdAt: "asc" },
  });
  if (ativo) return ativo;

  return prisma.learningCycle.findFirst({
    where: { userId, indice: 1 },
    orderBy: { createdAt: "asc" },
  });
}

export function parseCicloInicialResumo(ciclo: {
  id: string;
  indice: number;
  status: string;
  startAt: Date;
  endAt: Date;
  metaTitulo: string;
  metaEscopoId: string | null;
  metaMateria: string | null;
  baselineJson: string | null;
  narrativaInicioJson: string | null;
}): CicloInicialResumo | null {
  if (!ciclo.baselineJson) return null;
  try {
    const baseline = JSON.parse(ciclo.baselineJson) as BaselineCicloInicial;
    const narrativaRaw = ciclo.narrativaInicioJson
      ? (JSON.parse(ciclo.narrativaInicioJson) as NarrativaInicioCiclo & { hipotese?: string })
      : null;
    const narrativa: NarrativaInicioCiclo = narrativaRaw?.titulo
      ? narrativaRaw
      : {
          titulo: ciclo.metaTitulo,
          subtitulo: "Semana 1",
          mensagem: narrativaRaw?.hipotese ?? ciclo.metaTitulo,
          focoPrincipal: ciclo.metaTitulo,
          porqueEsseFoco: baseline.foco.motivo,
          comoVamosMedir: baseline.leitura.oQueSeraObservadoNaSemana,
          limiteDaSemana:
            "Semana 1 ainda não possui plano nem quests gerados — isso virá na próxima etapa.",
        };
    return {
      cicloId: ciclo.id,
      indice: ciclo.indice,
      status: ciclo.status,
      startAt: ciclo.startAt.toISOString(),
      endAt: ciclo.endAt.toISOString(),
      metaTitulo: ciclo.metaTitulo,
      metaEscopoId: ciclo.metaEscopoId,
      metaMateria: ciclo.metaMateria,
      baseline,
      narrativa,
    };
  } catch {
    return null;
  }
}

export async function buscarResumoCicloInicialJornada(
  userId: string
): Promise<CicloInicialResumo | null> {
  const ciclo = await buscarCicloSemana1Jornada(userId);
  if (!ciclo) return null;
  return parseCicloInicialResumo(ciclo);
}

async function persistirPrimeiroCiclo(
  userId: string,
  snapshotRow: SnapshotInicialRow,
  db: DbClient
): Promise<PrimeiroCicloResultado> {
  const snapshot = parseSnapshotInicialRow(snapshotRow);
  const foco = selecionarFocoInicialDoDiagnostico(snapshot);
  const baseline = montarBaselineCicloInicial(snapshot, foco);
  const narrativa = montarNarrativaInicioCiclo(snapshot, foco);

  const startAt = new Date();
  const endAt = new Date(startAt);
  endAt.setDate(endAt.getDate() + DIAS_CICLO);

  const metaTitulo = foco.escopoId ? `Semana 1: ${foco.titulo}` : "Semana 1: organização inicial";

  const created = await db.learningCycle.create({
    data: {
      userId,
      indice: 1,
      status: "ATIVO",
      startAt,
      endAt,
      metaTitulo,
      metaMateria: foco.materiaLabel,
      metaEscopoId: foco.escopoId,
      metaDominioId: foco.dominioId,
      metaConceitosJson:
        foco.conceitosCanonicos.length > 0 ? JSON.stringify(foco.conceitosCanonicos) : null,
      metaCognitivaJson:
        foco.padroesCognitivos.length > 0 ? JSON.stringify(foco.padroesCognitivos) : null,
      baselineJson: JSON.stringify(baseline),
      narrativaInicioJson: JSON.stringify(narrativa),
      storytellingJson: JSON.stringify({
        versao: "1.0",
        semana: 1,
        titulo: metaTitulo,
        focoLabel: foco.titulo,
        origem: "JourneyDiagnosticSnapshot:INICIAL",
        snapshotInicialId: snapshot.id,
      }),
    },
  });

  return { cicloId: created.id, criado: true, indice: 1 };
}

export async function criarOuObterPrimeiroCicloJornada(
  userId: string,
  snapshotRow?: SnapshotInicialRow | null,
  db: DbClient = prisma
): Promise<PrimeiroCicloResultado> {
  const snap =
    snapshotRow ??
    (await buscarSnapshotInicialJornada(userId));

  if (!snap || snap.tipo !== JOURNEY_DIAGNOSTIC_TIPO_INICIAL) {
    throw new Error("SEM_DIAGNOSTICO_INICIAL");
  }

  const [ativo, indice1] = await Promise.all([
    db.learningCycle.findFirst({
      where: { userId, status: "ATIVO" },
      orderBy: { createdAt: "asc" },
      select: { id: true, indice: true },
    }),
    db.learningCycle.findFirst({
      where: { userId, indice: 1 },
      orderBy: { createdAt: "asc" },
      select: { id: true, indice: true },
    }),
  ]);

  const acao = resolverAcaoCicloInicial({
    temSnapshotInicial: true,
    cicloAtivoId: ativo?.id ?? null,
    cicloIndice1Id: indice1?.id ?? null,
  });

  if (acao === "retornar_ativo" && ativo) {
    return { cicloId: ativo.id, criado: false, indice: ativo.indice };
  }
  if (acao === "retornar_indice1" && indice1) {
    return { cicloId: indice1.id, criado: false, indice: indice1.indice };
  }

  return persistirPrimeiroCiclo(userId, snap, db);
}
