import type { ProvaTipo } from "@/generated/prisma/client";
import { formatDataAplicacao } from "@/lib/data-prova";
import { pctAcertoRegistro } from "@/lib/exam-stats";
import {
  chaveConjuntoMultidia,
  formatConjuntoExamId,
  inferirDiaMultidia,
  normalizarNumeroMultidia,
  rotuloConjuntoCompleto,
  type ProvaMultidiaMeta,
} from "@/lib/prova-multidia";

type ProvaCatalogoRow = Omit<ProvaMultidiaMeta, "nome"> & {
  nome: string;
  tipo: ProvaTipo;
  cadernoStoragePath?: string | null;
};

type ExamResumo = {
  id: string;
  provaId: string | null;
  data: Date;
  questionAttempts: Array<{ numero: number; correto: boolean }>;
};

export type ProvaCatalogoItem = {
  kind: "single";
  id: string;
  nome: string;
  tipo: ProvaTipo;
  banca: string;
  ano: number | null;
  minhasTentativas: number;
  temCaderno: boolean;
  ultimaTentativa: {
    id: string;
    dataLabel: string;
    pctAcerto: number;
  } | null;
};

export type ConjuntoCatalogoItem = {
  kind: "conjunto";
  id: string;
  nome: string;
  tipo: ProvaTipo;
  banca: string;
  ano: number | null;
  provaIds: [string, string];
  totalQuestoes: number;
  temCaderno: boolean;
  ultimaTentativa: {
    id: string;
    examIds: [string, string];
    dataLabel: string;
    pctAcerto: number;
    totalQuestoes: number;
  };
};

export type ItemCatalogoAtividades = ProvaCatalogoItem | ConjuntoCatalogoItem;

function ultimoExamPorProva(exams: ExamResumo[]): Map<string, ExamResumo> {
  const map = new Map<string, ExamResumo>();
  for (const e of exams) {
    if (!e.provaId) continue;
    if (!map.has(e.provaId)) map.set(e.provaId, e);
  }
  return map;
}

function contagemPorProva(exams: ExamResumo[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of exams) {
    if (!e.provaId) continue;
    map.set(e.provaId, (map.get(e.provaId) ?? 0) + 1);
  }
  return map;
}

function pctConjuntoExams(
  provaD1: ProvaMultidiaMeta,
  provaD2: ProvaMultidiaMeta,
  examD1: ExamResumo,
  examD2: ExamResumo
): { pct: number; total: number } {
  const attempts = [
    ...examD1.questionAttempts.map((a) => ({
      ...a,
      numero: normalizarNumeroMultidia(a.numero, { ...provaD1, dia: 1 }),
      correto: a.correto,
    })),
    ...examD2.questionAttempts.map((a) => ({
      ...a,
      numero: normalizarNumeroMultidia(a.numero, { ...provaD2, dia: 2 }),
      correto: a.correto,
    })),
  ];
  const total = attempts.length;
  const acertos = attempts.filter((a) => a.correto).length;
  return {
    pct: total > 0 ? Math.round((acertos / total) * 100) : 0,
    total,
  };
}

/** Catálogo de Atividades — quando dia 1 + dia 2 estão registrados, vira 1 card de 180q. */
export function montarCatalogoAtividades(
  provasRaw: ProvaCatalogoRow[],
  meusExams: ExamResumo[]
): ItemCatalogoAtividades[] {
  const ultimaPorProva = ultimoExamPorProva(meusExams);
  const contagem = contagemPorProva(meusExams);
  const consumidas = new Set<string>();

  const pares = new Map<string, { dia1?: ProvaCatalogoRow; dia2?: ProvaCatalogoRow }>();
  for (const p of provasRaw) {
    const chave = chaveConjuntoMultidia(p);
    if (!chave) continue;
    const dia = inferirDiaMultidia(p);
    const bucket = pares.get(chave) ?? {};
    if (dia === 1) bucket.dia1 = p;
    else if (dia === 2) bucket.dia2 = p;
    pares.set(chave, bucket);
  }

  const conjuntos: ConjuntoCatalogoItem[] = [];

  for (const bucket of pares.values()) {
    const d1 = bucket.dia1;
    const d2 = bucket.dia2;
    if (!d1 || !d2) continue;

    const examD1 = ultimaPorProva.get(d1.id);
    const examD2 = ultimaPorProva.get(d2.id);
    if (!examD1 || !examD2) continue;

    consumidas.add(d1.id);
    consumidas.add(d2.id);

    const totalQuestoes = d1.totalQuestoes + d2.totalQuestoes;
    const { pct, total } = pctConjuntoExams(d1, d2, examD1, examD2);
    const dataLabel =
      examD1.data > examD2.data
        ? formatDataAplicacao(examD1.data)
        : formatDataAplicacao(examD2.data);

    conjuntos.push({
      kind: "conjunto",
      id: formatConjuntoExamId(examD1.id, examD2.id),
      nome: rotuloConjuntoCompleto(d1, totalQuestoes),
      tipo: d1.tipo,
      banca: d1.banca,
      ano: d1.ano,
      provaIds: [d1.id, d2.id],
      totalQuestoes,
      temCaderno: Boolean(d1.cadernoStoragePath || d2.cadernoStoragePath),
      ultimaTentativa: {
        id: formatConjuntoExamId(examD1.id, examD2.id),
        examIds: [examD1.id, examD2.id],
        dataLabel,
        pctAcerto: total > 0 ? pct : pctAcertoRegistro([...examD1.questionAttempts, ...examD2.questionAttempts]),
        totalQuestoes: total,
      },
    });
  }

  const singles: ProvaCatalogoItem[] = provasRaw
    .filter((p) => !consumidas.has(p.id))
    .map((p) => {
      const ultima = ultimaPorProva.get(p.id);
      const total = ultima?.questionAttempts.length ?? 0;
      const acertos = ultima?.questionAttempts.filter((q) => q.correto).length ?? 0;
      return {
        kind: "single" as const,
        id: p.id,
        nome: p.nome,
        tipo: p.tipo,
        banca: p.banca,
        ano: p.ano,
        minhasTentativas: contagem.get(p.id) ?? 0,
        temCaderno: Boolean(p.cadernoStoragePath),
        ultimaTentativa: ultima
          ? {
              id: ultima.id,
              dataLabel: formatDataAplicacao(ultima.data),
              pctAcerto: total > 0 ? Math.round((acertos / total) * 100) : 0,
            }
          : null,
      };
    });

  return [...conjuntos, ...singles].sort((a, b) => {
    const nomeA = a.nome.toLowerCase();
    const nomeB = b.nome.toLowerCase();
    if (nomeA !== nomeB) return nomeA.localeCompare(nomeB, "pt-BR");
    return a.kind === "conjunto" ? -1 : 1;
  });
}
