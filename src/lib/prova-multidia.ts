import type { ModoUsoRegistro, ProvaTipo } from "@/generated/prisma/client";
import { buildProvaNome } from "@/lib/prova-nome";
import { pesoModoUso } from "@/lib/modo-uso";
import { resolverNumerosGradeProva } from "@/lib/prova-numeracao";

/** Metadados mínimos da prova para parear dia 1 + dia 2. */
export type ProvaMultidiaMeta = {
  id: string;
  banca: string;
  ano: number | null;
  dia: number | null;
  tipo: ProvaTipo;
  totalQuestoes: number;
  caderno?: string | null;
  nome?: string;
};

export const PROVA_SELECT_MULTIDIA = {
  id: true,
  nome: true,
  banca: true,
  ano: true,
  dia: true,
  tipo: true,
  totalQuestoes: true,
  caderno: true,
} as const;

export type QuestionAttemptMultidia = {
  numero: number;
  correto: boolean;
  materiaId?: string | null;
  temaId?: string | null;
  tipoErro?: string | null;
  observacao?: string | null;
  materiaCorrigida?: string | null;
  assuntoCorrigido?: string | null;
  respostaAluno?: string | null;
  provaQuestao?: {
    materia: string;
    assunto: string;
    conhecimentoExigido?: string | null;
    nivelDificuldade?: string | null;
  } | null;
};

/** Entrada mínima para parear dia 1 + dia 2 (aceita selects parciais do Prisma). */
export type ExamParaAgrupamento<Q extends { numero: number } = { numero: number }> = {
  id: string;
  data: Date;
  modoUso: ModoUsoRegistro;
  banca: string | null;
  nome: string;
  provaId: string | null;
  prova?: ProvaMultidiaMeta | null;
  questionAttempts: Q[];
};

export type ExamParaMultidia = ExamParaAgrupamento<QuestionAttemptMultidia>;

export type UnidadeRegistroJornada<T extends ExamParaAgrupamento = ExamParaAgrupamento> = {
  id: string;
  examIds: string[];
  conjuntoMultidia: boolean;
  data: Date;
  modoUso: ModoUsoRegistro;
  banca: string | null;
  nome: string;
  provaId: string | null;
  totalQuestoes: number;
  questionAttempts: T["questionAttempts"];
  exames: T[];
};

/** Inferência de dia quando o admin não preencheu o campo (comum). */
export function inferirDiaMultidia(
  prova: ProvaMultidiaMeta,
  numeros?: number[]
): 1 | 2 | null {
  if (prova.dia === 1 || prova.dia === 2) return prova.dia;

  const nome = (prova.nome ?? "").toLowerCase();
  if (/\bdia\s*1\b/.test(nome)) return 1;
  if (/\bdia\s*2\b/.test(nome)) return 2;

  if (numeros && numeros.length > 0) {
    const min = Math.min(...numeros);
    const max = Math.max(...numeros);
    const nums = resolverNumerosGradeProva({
      totalQuestoes: prova.totalQuestoes,
      dia: 2,
      banca: prova.banca,
    });
    const inicioD2 = nums[0] ?? 91;
    if (min >= inicioD2 || max > prova.totalQuestoes) return 2;
    if (max <= prova.totalQuestoes && min >= 1) return 1;
  }

  return null;
}

function provaComDiaEfetivo(
  prova: ProvaMultidiaMeta,
  numeros?: number[]
): ProvaMultidiaMeta {
  const dia = inferirDiaMultidia(prova, numeros);
  return dia != null ? { ...prova, dia } : prova;
}

function ehProvaEnemLike(prova: ProvaMultidiaMeta): boolean {
  const bancaU = prova.banca.trim().toUpperCase();
  const nomeU = (prova.nome ?? "").toUpperCase();
  return bancaU.includes("ENEM") || nomeU.includes("ENEM");
}

/** Instituição/evento no caderno (ex.: "HEXAG 13/06" → "HEXAG"). */
function prefixoEdicaoCaderno(caderno: string | null | undefined): string {
  if (!caderno?.trim()) return "";
  return caderno.trim().split(/\s+/)[0]!.toUpperCase();
}

/** Chave de agrupamento: mesma edição dia 1 + dia 2 (ignora data no caderno). */
export function chaveConjuntoMultidia(
  prova: ProvaMultidiaMeta,
  numeros?: number[]
): string | null {
  const dia = inferirDiaMultidia(prova, numeros);
  if (dia !== 1 && dia !== 2) return null;

  const ano = prova.ano ?? 0;

  if (ehProvaEnemLike(prova)) {
    // SIMULADO ENEM — 2026 — Dia N — HEXAG dd/mm → uma edição só
    const inst = prefixoEdicaoCaderno(prova.caderno);
    return inst ? `ENEM|${ano}|${inst}` : `ENEM|${ano}`;
  }

  const bancaU = prova.banca.trim().toUpperCase();
  const inst = prefixoEdicaoCaderno(prova.caderno);
  return `${bancaU}|${prova.tipo}|${ano}|${inst}`;
}

/** Alinha numeração ao slot global (ex.: dia 2 → 91–180). */
export function normalizarNumeroMultidia(numero: number, prova: ProvaMultidiaMeta): number {
  const nums = resolverNumerosGradeProva({
    totalQuestoes: prova.totalQuestoes,
    dia: prova.dia,
    banca: prova.banca,
  });
  const esperadoSet = new Set(nums);
  if (esperadoSet.has(numero)) return numero;
  const offset = (nums[0] ?? 1) - 1;
  const shifted = numero + offset;
  if (esperadoSet.has(shifted)) return shifted;
  return numero;
}

function modoDominante(a: ModoUsoRegistro, b: ModoUsoRegistro): ModoUsoRegistro {
  return pesoModoUso(a) >= pesoModoUso(b) ? a : b;
}

function nomeConjuntoMultidia(p1: ProvaMultidiaMeta, totalQuestoes: number): string {
  if (ehProvaEnemLike(p1)) {
    const inst = prefixoEdicaoCaderno(p1.caderno);
    const ano = p1.ano != null ? String(p1.ano) : "";
    const base = ["ENEM", ano, inst].filter(Boolean).join(" — ");
    return `${base} (completa — ${totalQuestoes} questões)`;
  }
  const base = buildProvaNome({
    banca: p1.banca,
    ano: p1.ano,
    caderno: prefixoEdicaoCaderno(p1.caderno) || p1.caderno,
  });
  return `${base} (completa — ${totalQuestoes} questões)`;
}

function toUnidade<T extends ExamParaAgrupamento>(exam: T, conjunto: boolean): UnidadeRegistroJornada<T> {
  return {
    id: exam.id,
    examIds: [exam.id],
    conjuntoMultidia: conjunto,
    data: exam.data,
    modoUso: exam.modoUso,
    banca: exam.banca,
    nome: exam.nome,
    provaId: exam.provaId,
    totalQuestoes: exam.questionAttempts.length,
    questionAttempts: exam.questionAttempts,
    exames: [exam],
  };
}

function mergeParMultidia<T extends ExamParaAgrupamento>(d1: T, d2: T): UnidadeRegistroJornada<T> {
  const nums1 = d1.questionAttempts.map((a) => a.numero);
  const nums2 = d2.questionAttempts.map((a) => a.numero);
  const p1 = provaComDiaEfetivo(d1.prova!, nums1);
  const p2 = provaComDiaEfetivo(d2.prova!, nums2);
  const attempts = [
    ...d1.questionAttempts.map((a) => ({
      ...a,
      numero: normalizarNumeroMultidia(a.numero, p1),
    })),
    ...d2.questionAttempts.map((a) => ({
      ...a,
      numero: normalizarNumeroMultidia(a.numero, p2),
    })),
  ];
  const totalQuestoes = p1.totalQuestoes + p2.totalQuestoes;
  const data = d1.data > d2.data ? d1.data : d2.data;
  return {
    id: `conjunto:${d1.id}+${d2.id}`,
    examIds: [d1.id, d2.id],
    conjuntoMultidia: true,
    data,
    modoUso: modoDominante(d1.modoUso, d2.modoUso),
    banca: d1.banca ?? p1.banca,
    nome: nomeConjuntoMultidia(p1, totalQuestoes),
    provaId: d1.provaId,
    totalQuestoes,
    questionAttempts: attempts as T["questionAttempts"],
    exames: [d1, d2],
  };
}

/**
 * Agrupa registros dia 1 + dia 2 da mesma edição em uma unidade (ex.: ENEM 180q).
 * Dias sem par permanecem isolados.
 */
export function agruparUnidadesJornada<T extends ExamParaAgrupamento>(
  exams: T[]
): UnidadeRegistroJornada<T>[] {
  const singles: UnidadeRegistroJornada<T>[] = [];
  const byChave = new Map<string, { dia1: T[]; dia2: T[] }>();

  for (const exam of exams) {
    const prova = exam.prova;
    if (!prova) {
      singles.push(toUnidade(exam, false));
      continue;
    }
    const numeros = exam.questionAttempts.map((a) => a.numero);
    const chave = chaveConjuntoMultidia(prova, numeros);
    if (!chave) {
      singles.push(toUnidade(exam, false));
      continue;
    }
    const dia = inferirDiaMultidia(prova, numeros);
    const bucket = byChave.get(chave) ?? { dia1: [], dia2: [] };
    if (dia === 1) bucket.dia1.push(exam);
    else if (dia === 2) bucket.dia2.push(exam);
    else singles.push(toUnidade(exam, false));
    byChave.set(chave, bucket);
  }

  const merged: UnidadeRegistroJornada<T>[] = [];

  for (const bucket of byChave.values()) {
    bucket.dia1.sort((a, b) => b.data.getTime() - a.data.getTime());
    bucket.dia2.sort((a, b) => b.data.getTime() - a.data.getTime());
    const n = Math.min(bucket.dia1.length, bucket.dia2.length);
    for (let i = 0; i < n; i++) {
      merged.push(mergeParMultidia(bucket.dia1[i]!, bucket.dia2[i]!));
    }
    for (let i = n; i < bucket.dia1.length; i++) {
      singles.push(toUnidade(bucket.dia1[i]!, false));
    }
    for (let i = n; i < bucket.dia2.length; i++) {
      singles.push(toUnidade(bucket.dia2[i]!, false));
    }
  }

  return [...merged, ...singles].sort((a, b) => b.data.getTime() - a.data.getTime());
}

export type ResumoMultidiaJornada<T extends ExamParaAgrupamento = ExamParaAgrupamento> = {
  unidades: UnidadeRegistroJornada<T>[];
  registrosNaLista: number;
  provasCompletasMultidia: number;
  nomesCompletos: string[];
};

/** Conta pareamentos dia 1+2 para exibir na UI e no resumo da jornada. */
export function resumoMultidiaJornada<T extends ExamParaAgrupamento>(
  exams: T[]
): ResumoMultidiaJornada<T> {
  const unidades = agruparUnidadesJornada(exams);
  const completas = unidades.filter((u) => u.conjuntoMultidia);
  return {
    unidades,
    registrosNaLista: exams.length,
    provasCompletasMultidia: completas.length,
    nomesCompletos: completas.map((u) => u.nome),
  };
}

/** Exam sintético para funções que esperam shape de Exam (analytics, comparativos). */
export function unidadeComoExam<T extends ExamParaAgrupamento>(
  u: UnidadeRegistroJornada<T>
): T & { provaId: string | null } {
  const base = u.exames[0]!;
  return {
    ...base,
    id: u.id,
    data: u.data,
    modoUso: u.modoUso,
    banca: u.banca,
    nome: u.nome,
    provaId: u.provaId,
    questionAttempts: u.questionAttempts as T["questionAttempts"],
  };
}
