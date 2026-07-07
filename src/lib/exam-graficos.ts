/**
 * Dados serializáveis para gráficos da análise de uma prova (motor v1 — escopo N2).
 */
import type { ErrorType } from "@/generated/prisma/client";
import { labelEscopo } from "@/lib/escopo-display-server";
import { getTipoErroLabel, taxonomy } from "@/lib/taxonomy";

const CORES_CAUSA: Record<string, string> = {
  CONCEITO_TEORICO: "#7c3aed",
  CALCULO_BOBEIRA: "#d97706",
  INTERPRETACAO_ENUNCIADO: "#2563eb",
  DUVIDA_CRUCIAL: "#e11d48",
  CHUTE_TOTAL: "#64748b",
  FALTA_TEMPO: "#ea580c",
};

export type ExamCausa = { label: string; count: number; pct: number; cor: string };
export type ExamEscopo = { escopoId: string; label: string; pct: number; total: number; erros: number };
export type ExamConhecimento = { texto: string; erros: number; escopoId?: string | null };

export type ExamGraficos = {
  total: number;
  acertos: number;
  pctAcerto: number;
  totalErros: number;
  errosClassificados: number;
  pctErrosClassificados: number;
  escopos: ExamEscopo[];
  causas: ExamCausa[];
  conhecimentos: ExamConhecimento[];
};

type AttemptInput = {
  correto: boolean;
  tipoErro: ErrorType | string | null;
  conhecimentoEscopoId?: string | null;
  provaQuestao?: {
    conhecimentoEscopoId?: string | null;
    conhecimentoExigido?: string | null;
  } | null;
};

function escopoIdDe(a: AttemptInput): string | null {
  return (
    a.conhecimentoEscopoId?.trim() ||
    a.provaQuestao?.conhecimentoEscopoId?.trim() ||
    null
  );
}

export function montarExamGraficos(attempts: AttemptInput[]): ExamGraficos {
  const total = attempts.length;
  const acertos = attempts.filter((a) => a.correto).length;
  const incorretas = attempts.filter((a) => !a.correto);
  const totalErros = incorretas.length;

  const porEscopo = new Map<string, { total: number; acertos: number; erros: number }>();
  for (const a of attempts) {
    const escopoId = escopoIdDe(a) ?? "__sem_n2__";
    const entry = porEscopo.get(escopoId) ?? { total: 0, acertos: 0, erros: 0 };
    entry.total += 1;
    if (a.correto) entry.acertos += 1;
    else entry.erros += 1;
    porEscopo.set(escopoId, entry);
  }

  const escopos: ExamEscopo[] = [...porEscopo.entries()]
    .filter(([id]) => id !== "__sem_n2__")
    .map(([escopoId, v]) => ({
      escopoId,
      label: labelEscopo(escopoId) ?? escopoId,
      total: v.total,
      erros: v.erros,
      pct: v.total > 0 ? Math.round((v.acertos / v.total) * 100) : 0,
    }))
    .sort((a, b) => a.pct - b.pct || b.erros - a.erros);

  const counts = new Map<string, number>();
  let errosClassificados = 0;
  for (const a of incorretas) {
    if (a.tipoErro) {
      errosClassificados += 1;
      counts.set(a.tipoErro, (counts.get(a.tipoErro) ?? 0) + 1);
    }
  }
  const causas: ExamCausa[] = taxonomy.tiposErro
    .map((t) => {
      const count = counts.get(t.id) ?? 0;
      return {
        label: getTipoErroLabel(t.id) ?? t.label,
        count,
        pct: errosClassificados > 0 ? Math.round((count / errosClassificados) * 100) : 0,
        cor: CORES_CAUSA[t.id] ?? "#94a3b8",
      };
    })
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  const porConhecimento = new Map<string, ExamConhecimento>();
  for (const a of incorretas) {
    const escopoId = escopoIdDe(a);
    const raw = a.provaQuestao?.conhecimentoExigido?.trim();
    const chave = escopoId ?? raw ?? "";
    if (!chave) continue;
    const labelEscopoN2 = escopoId ? labelEscopo(escopoId) ?? escopoId : null;
    const texto =
      labelEscopoN2 ??
      (raw && raw.length >= 8
        ? raw.length > 80
          ? `${raw.slice(0, 77)}…`
          : raw
        : "Conteúdo sem rótulo");
    const entry = porConhecimento.get(chave) ?? { texto, erros: 0, escopoId };
    entry.erros += 1;
    porConhecimento.set(chave, entry);
  }
  const conhecimentos = [...porConhecimento.values()]
    .sort((a, b) => b.erros - a.erros)
    .slice(0, 6);

  return {
    total,
    acertos,
    pctAcerto: total > 0 ? Math.round((acertos / total) * 100) : 0,
    totalErros,
    errosClassificados,
    pctErrosClassificados:
      totalErros > 0 ? Math.round((errosClassificados / totalErros) * 100) : 0,
    escopos,
    causas,
    conhecimentos,
  };
}
