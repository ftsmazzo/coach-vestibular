/**
 * Evidência canônica da Jornada — fonte única para agregação por escopo.
 * Etapa 4E-A: attempt → ProvaQuestao → catálogo por número; N2 real; N3.
 */
import type { ErrorType } from "@/generated/prisma/client";
import {
  questaoTemN1N2N3,
  resolverClassificacaoAttempt,
  type AttemptClassificacaoRow,
  type QuestaoCatalogoClassificacao,
} from "@/lib/jornada-classificacao-attempt";
import { catalogoQuestoesUnidadeJornada, nomeProvaUnidadeJornada } from "@/lib/jornada-catalogo-unidade";
import { escopoN2Real } from "@/lib/classificacao-n2-types";
import { indexGlobalEscopos } from "@/lib/conhecimento-catalog/load";
import {
  agruparUnidadesJornada,
  PROVA_SELECT_MULTIDIA,
  type ExamParaAgrupamento,
  type UnidadeRegistroJornada,
} from "@/lib/prova-multidia";
import { unidadeValidaParaJornada } from "@/lib/jornada-elegibilidade";
import { prisma } from "@/lib/prisma";

export type QuestaoEvidenciaCanonica = {
  examId: string;
  unidadeId: string;
  nomeProva: string;
  modoUso: string;
  numero: number;
  correto: boolean;
  escopoId: string;
  escopoLabel: string;
  conhecimentoExigido: string | null;
  tipoErro: string | null;
  escopoIdAttempt: string | null;
  escopoIdProvaQuestao: string | null;
  divergenciaEscopo: boolean;
};

export type EscopoPorProvaCanonica = {
  escopoId: string;
  label: string;
  total: number;
  acertos: number;
  erros: number;
  pctErro: number;
  numerosQuestoes: number[];
  numerosErradas: number[];
  n3: string[];
  tiposErro: Record<string, number>;
};

export type ProvaEvidenciaCanonica = {
  examId: string;
  provaId?: string | null;
  nome: string;
  modoUso: string;
  total: number;
  acertos: number;
  erros: number;
  pctAcerto: number;
  porEscopo: EscopoPorProvaCanonica[];
};

export type OcorrenciaEscopoPorProva = {
  examId: string;
  nome: string;
  total: number;
  erros: number;
  numerosErradas: number[];
};

export type EscopoAgregadoCanonica = {
  escopoId: string;
  label: string;
  total: number;
  acertos: number;
  erros: number;
  pctErro: number;
  provasComQuestao: number;
  provasComErro: number;
  ocorrenciasPorProva: OcorrenciaEscopoPorProva[];
  n3Recorrentes: string[];
  tiposErroDominantes: Array<{ tipo: string; count: number }>;
};

export type EvidenciaCanonicaFoco = {
  escopoId: string;
  label: string;
  total: number;
  acertos: number;
  erros: number;
  pctErro: number;
  provasComErro: number;
  provasComQuestao: number;
  ocorrenciasPorProva: OcorrenciaEscopoPorProva[];
  n3Recorrentes: string[];
  tiposErro: Record<string, number>;
};

export type TotaisEvidenciaCanonica = {
  provasValidas: number;
  questoesValidas: number;
  acertos: number;
  erros: number;
  errosAnalisaveis: number;
  pctAcerto: number;
  pctQuestoesComClassificacaoCompleta: number;
};

export type ResultadoEvidenciaCanonicaJornada = {
  questoes: QuestaoEvidenciaCanonica[];
  porProva: ProvaEvidenciaCanonica[];
  agregadoPorEscopo: EscopoAgregadoCanonica[];
  totais: TotaisEvidenciaCanonica;
};

type AttemptRow = AttemptClassificacaoRow & {
  numero: number;
  tipoErro?: ErrorType | string | null;
};

export function resolverQuestaoEvidenciaCanonica(
  examId: string,
  unidadeId: string,
  nomeProva: string,
  modoUso: string,
  attempt: AttemptRow,
  catalogo?: QuestaoCatalogoClassificacao | null
): QuestaoEvidenciaCanonica | null {
  const classificacao = resolverClassificacaoAttempt(attempt, catalogo ?? null);
  if (!questaoTemN1N2N3(classificacao)) return null;
  const escopoId = classificacao.escopoId;
  if (!escopoId || !escopoN2Real(escopoId)) return null;

  const escopoIdAttempt = attempt.conhecimentoEscopoId?.trim() || null;
  const escopoIdProvaQuestao =
    attempt.provaQuestao?.conhecimentoEscopoId?.trim() ||
    catalogo?.conhecimentoEscopoId?.trim() ||
    null;

  return {
    examId,
    unidadeId,
    nomeProva,
    modoUso,
    numero: attempt.numero,
    correto: attempt.correto,
    escopoId,
    escopoLabel: indexGlobalEscopos().get(escopoId)?.escopoLabel ?? escopoId,
    conhecimentoExigido: classificacao.conhecimentoExigido,
    tipoErro: attempt.tipoErro ? String(attempt.tipoErro) : null,
    escopoIdAttempt,
    escopoIdProvaQuestao,
    divergenciaEscopo: Boolean(
      escopoIdAttempt && escopoIdProvaQuestao && escopoIdAttempt !== escopoIdProvaQuestao
    ),
  };
}

function montarPorEscopoProva(questoes: QuestaoEvidenciaCanonica[]): EscopoPorProvaCanonica[] {
  const map = new Map<string, EscopoPorProvaCanonica>();

  for (const q of questoes) {
    let row = map.get(q.escopoId);
    if (!row) {
      row = {
        escopoId: q.escopoId,
        label: q.escopoLabel,
        total: 0,
        acertos: 0,
        erros: 0,
        pctErro: 0,
        numerosQuestoes: [],
        numerosErradas: [],
        n3: [],
        tiposErro: {},
      };
      map.set(q.escopoId, row);
    }
    row.total++;
    row.numerosQuestoes.push(q.numero);
    if (q.correto) row.acertos++;
    else {
      row.erros++;
      row.numerosErradas.push(q.numero);
      if (q.tipoErro) row.tiposErro[q.tipoErro] = (row.tiposErro[q.tipoErro] ?? 0) + 1;
      if (q.conhecimentoExigido && !row.n3.includes(q.conhecimentoExigido)) {
        row.n3.push(q.conhecimentoExigido);
      }
    }
  }

  return [...map.values()]
    .map((r) => ({
      ...r,
      pctErro: r.total > 0 ? Math.round((r.erros / r.total) * 100) : 0,
    }))
    .sort((a, b) => b.erros - a.erros || b.pctErro - a.pctErro);
}

function pesoDiagnosticoProxy(e: { erros: number; provasComErro: number }): number {
  return e.erros * 2 + e.provasComErro * 3;
}

export function agregarEvidenciasCanonicas(
  questoes: QuestaoEvidenciaCanonica[]
): EscopoAgregadoCanonica[] {
  const map = new Map<
    string,
    EscopoAgregadoCanonica & {
      examsComQuestao: Set<string>;
      examsComErro: Set<string>;
      tiposErro: Map<string, number>;
      n3: Set<string>;
    }
  >();

  for (const q of questoes) {
    let row = map.get(q.escopoId);
    if (!row) {
      row = {
        escopoId: q.escopoId,
        label: q.escopoLabel,
        total: 0,
        acertos: 0,
        erros: 0,
        pctErro: 0,
        provasComQuestao: 0,
        provasComErro: 0,
        ocorrenciasPorProva: [],
        n3Recorrentes: [],
        tiposErroDominantes: [],
        examsComQuestao: new Set(),
        examsComErro: new Set(),
        tiposErro: new Map(),
        n3: new Set(),
      };
      map.set(q.escopoId, row);
    }

    row.total++;
    row.examsComQuestao.add(q.examId);
    if (q.correto) row.acertos++;
    else {
      row.erros++;
      row.examsComErro.add(q.examId);
      if (q.tipoErro) row.tiposErro.set(q.tipoErro, (row.tiposErro.get(q.tipoErro) ?? 0) + 1);
      if (q.conhecimentoExigido) row.n3.add(q.conhecimentoExigido);
    }
  }

  return [...map.values()]
    .map((row) => {
      const porProvaMap = new Map<string, OcorrenciaEscopoPorProva>();
      for (const q of questoes.filter((x) => x.escopoId === row.escopoId)) {
        const cur = porProvaMap.get(q.examId) ?? {
          examId: q.examId,
          nome: q.nomeProva,
          total: 0,
          erros: 0,
          numerosErradas: [],
        };
        cur.total++;
        if (!q.correto) {
          cur.erros++;
          cur.numerosErradas.push(q.numero);
        }
        porProvaMap.set(q.examId, cur);
      }

      return {
        escopoId: row.escopoId,
        label: row.label,
        total: row.total,
        acertos: row.acertos,
        erros: row.erros,
        pctErro: row.total > 0 ? Math.round((row.erros / row.total) * 100) : 0,
        provasComQuestao: row.examsComQuestao.size,
        provasComErro: row.examsComErro.size,
        ocorrenciasPorProva: [...porProvaMap.values()].sort((a, b) => b.erros - a.erros),
        n3Recorrentes: [...row.n3].slice(0, 8),
        tiposErroDominantes: [...row.tiposErro.entries()]
          .map(([tipo, count]) => ({ tipo, count }))
          .sort((a, b) => b.count - a.count),
      };
    })
    .sort((a, b) => pesoDiagnosticoProxy(b) - pesoDiagnosticoProxy(a));
}

export function evidenciaCanonicaFocoDeAgregado(
  escopo: EscopoAgregadoCanonica
): EvidenciaCanonicaFoco {
  return {
    escopoId: escopo.escopoId,
    label: escopo.label,
    total: escopo.total,
    acertos: escopo.acertos,
    erros: escopo.erros,
    pctErro: escopo.pctErro,
    provasComErro: escopo.provasComErro,
    provasComQuestao: escopo.provasComQuestao,
    ocorrenciasPorProva: escopo.ocorrenciasPorProva,
    n3Recorrentes: escopo.n3Recorrentes,
    tiposErro: Object.fromEntries(escopo.tiposErroDominantes.map((t) => [t.tipo, t.count])),
  };
}

/** Texto explícito: agregado longitudinal vs por prova. */
export function formatarEvidenciaFocoAgregada(ev: EvidenciaCanonicaFoco): string {
  const partes = [
    `${ev.erros} erro(s) em ${ev.total} questão(ões) de ${ev.label} (somando as provas consideradas)`,
  ];
  if (ev.provasComErro >= 2) {
    const detalhe = ev.ocorrenciasPorProva
      .filter((o) => o.erros > 0)
      .map((o) => `${o.nome}: ${o.erros} erro(s) (questões ${o.numerosErradas.join(", ")})`)
      .join("; ");
    partes.push(`distribuídos em ${ev.provasComErro} provas (${detalhe})`);
  } else if (ev.ocorrenciasPorProva[0]) {
    const o = ev.ocorrenciasPorProva[0];
    partes.push(`nesta amostra: ${o.nome} — ${o.erros} erro(s)`);
  }
  return `${partes.join(" — ")}.`;
}

export function formatarEvidenciaFocoPorProva(
  escopo: EscopoPorProvaCanonica,
  nomeProva: string
): string {
  return `${escopo.erros} erro(s) em ${escopo.total} questão(ões) de ${escopo.label} nesta prova (${nomeProva}).`;
}

export type UnidadeEvidenciaInput = UnidadeRegistroJornada<
  ExamParaAgrupamento<{
    numero: number;
    correto: boolean;
    materiaId?: string | null;
    conhecimentoDominioId?: string | null;
    conhecimentoEscopoId?: string | null;
    conhecimentoExigido?: string | null;
    tipoErro?: ErrorType | string | null;
    provaQuestao?: QuestaoCatalogoClassificacao | null;
  }>
>;

export function processarUnidadesEvidenciaCanonica(
  unidades: UnidadeEvidenciaInput[]
): ResultadoEvidenciaCanonicaJornada {
  const questoes: QuestaoEvidenciaCanonica[] = [];
  const porProva: ProvaEvidenciaCanonica[] = [];

  for (const unidade of unidades) {
    const catalogo = catalogoQuestoesUnidadeJornada(unidade);
    const nome = nomeProvaUnidadeJornada(unidade);
    const examId = unidade.examIds[0] ?? unidade.id;
    const questoesUnidade: QuestaoEvidenciaCanonica[] = [];

    for (const attempt of unidade.questionAttempts as AttemptRow[]) {
      const q = resolverQuestaoEvidenciaCanonica(
        examId,
        unidade.id,
        nome,
        unidade.modoUso,
        attempt,
        catalogo.get(attempt.numero) ?? null
      );
      if (q) questoesUnidade.push(q);
    }

    questoes.push(...questoesUnidade);
    const acertos = questoesUnidade.filter((q) => q.correto).length;
    const total = questoesUnidade.length;
    porProva.push({
      examId,
      provaId: unidade.provaId,
      nome,
      modoUso: unidade.modoUso,
      total,
      acertos,
      erros: total - acertos,
      pctAcerto: total > 0 ? Math.round((acertos / total) * 100) : 0,
      porEscopo: montarPorEscopoProva(questoesUnidade),
    });
  }

  const agregadoPorEscopo = agregarEvidenciasCanonicas(questoes);
  const errosAnalisaveis = questoes.filter((q) => !q.correto).length;
  const acertos = questoes.filter((q) => q.correto).length;

  return {
    questoes,
    porProva,
    agregadoPorEscopo,
    totais: {
      provasValidas: porProva.length,
      questoesValidas: questoes.length,
      acertos,
      erros: questoes.length - acertos,
      errosAnalisaveis,
      pctAcerto: questoes.length > 0 ? Math.round((acertos / questoes.length) * 100) : 0,
      pctQuestoesComClassificacaoCompleta: 100,
    },
  };
}

export async function coletarEvidenciaCanonicaJornada(
  userId: string,
  db: typeof prisma = prisma
): Promise<ResultadoEvidenciaCanonicaJornada> {
  const exams = await db.exam.findMany({
    where: { userId },
    include: {
      questionAttempts: { include: { provaQuestao: true } },
      prova: {
        select: {
          ...PROVA_SELECT_MULTIDIA,
          questoes: {
            select: {
              numero: true,
              materia: true,
              classificacaoN1Json: true,
              conhecimentoDominioId: true,
              conhecimentoEscopoId: true,
              conhecimentoExigido: true,
            },
          },
        },
      },
    },
    orderBy: { data: "asc" },
  });

  const unidades = agruparUnidadesJornada(exams).filter(unidadeValidaParaJornada);
  return processarUnidadesEvidenciaCanonica(unidades as UnidadeEvidenciaInput[]);
}

export function buscarEscopoAgregadoCanonica(
  resultado: ResultadoEvidenciaCanonicaJornada,
  escopoIdOuLabel: string
): EscopoAgregadoCanonica | null {
  const needle = escopoIdOuLabel.toLowerCase();
  return (
    resultado.agregadoPorEscopo.find(
      (e) =>
        e.escopoId === escopoIdOuLabel ||
        e.label.toLowerCase() === needle ||
        e.label.toLowerCase().includes(needle)
    ) ?? null
  );
}
