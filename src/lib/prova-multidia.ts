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

export type ExamParaMultidia = {
  id: string;
  data: Date;
  modoUso: ModoUsoRegistro;
  banca: string | null;
  nome: string;
  provaId: string | null;
  prova?: ProvaMultidiaMeta | null;
  questionAttempts: Array<{ numero: number } & Record<string, unknown>>;
};

export type UnidadeRegistroJornada<T extends ExamParaMultidia = ExamParaMultidia> = {
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

/** Chave de agrupamento: mesma banca + ano + tipo (+ caderno) com dia 1 e 2. */
export function chaveConjuntoMultidia(prova: ProvaMultidiaMeta): string | null {
  if (prova.dia !== 1 && prova.dia !== 2) return null;
  const ano = prova.ano ?? 0;
  const caderno = (prova.caderno ?? "").trim().toUpperCase();
  return `${prova.banca.trim().toUpperCase()}|${prova.tipo}|${ano}|${caderno}`;
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
  const base = buildProvaNome({
    banca: p1.banca,
    ano: p1.ano,
    caderno: p1.caderno,
  });
  return `${base} (completa — ${totalQuestoes} questões)`;
}

function toUnidade<T extends ExamParaMultidia>(exam: T, conjunto: boolean): UnidadeRegistroJornada<T> {
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

function mergeParMultidia<T extends ExamParaMultidia>(d1: T, d2: T): UnidadeRegistroJornada<T> {
  const p1 = d1.prova!;
  const p2 = d2.prova!;
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
export function agruparUnidadesJornada<T extends ExamParaMultidia>(
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
    const chave = chaveConjuntoMultidia(prova);
    if (!chave) {
      singles.push(toUnidade(exam, false));
      continue;
    }
    const bucket = byChave.get(chave) ?? { dia1: [], dia2: [] };
    if (prova.dia === 1) bucket.dia1.push(exam);
    else bucket.dia2.push(exam);
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

/** Exam sintético para funções que esperam shape de Exam (analytics, comparativos). */
export function unidadeComoExam<T extends ExamParaMultidia>(
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
