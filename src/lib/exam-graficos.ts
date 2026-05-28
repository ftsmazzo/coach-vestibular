/**
 * Dados serializáveis para os gráficos da ANÁLISE de uma prova (uma tentativa).
 * Escopo: só este Exam — não mistura com a jornada.
 */
import type { ErrorType } from "@/generated/prisma/client";
import { getMateriaLabel, getTipoErroLabel, taxonomy } from "@/lib/taxonomy";

const CORES_CAUSA: Record<string, string> = {
  CONCEITO_TEORICO: "#7c3aed",
  CALCULO_BOBEIRA: "#d97706",
  INTERPRETACAO_ENUNCIADO: "#2563eb",
  DUVIDA_CRUCIAL: "#e11d48",
  CHUTE_TOTAL: "#64748b",
  FALTA_TEMPO: "#ea580c",
};

export type ExamCausa = { label: string; count: number; pct: number; cor: string };
export type ExamMateria = { nome: string; pct: number; total: number };
export type ExamConhecimento = { texto: string; erros: number };

export type ExamGraficos = {
  total: number;
  acertos: number;
  pctAcerto: number;
  totalErros: number;
  errosClassificados: number;
  pctErrosClassificados: number;
  materias: ExamMateria[];
  causas: ExamCausa[];
  conhecimentos: ExamConhecimento[];
};

type AttemptInput = {
  correto: boolean;
  tipoErro: ErrorType | string | null;
  materiaId: string | null;
  materiaCorrigida?: string | null;
  provaQuestao?: { materia: string; conhecimentoExigido: string | null } | null;
};

function normaliza(s: string): string {
  return s.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").slice(0, 200);
}

export function montarExamGraficos(attempts: AttemptInput[]): ExamGraficos {
  const total = attempts.length;
  const acertos = attempts.filter((a) => a.correto).length;
  const incorretas = attempts.filter((a) => !a.correto);
  const totalErros = incorretas.length;

  // Matérias: % de acerto por matéria nesta prova
  const porMateria = new Map<string, { total: number; acertos: number }>();
  for (const a of attempts) {
    const nome =
      a.provaQuestao?.materia?.trim() ||
      a.materiaCorrigida?.trim() ||
      getMateriaLabel(a.materiaId) ||
      "Sem matéria";
    const entry = porMateria.get(nome) ?? { total: 0, acertos: 0 };
    entry.total += 1;
    if (a.correto) entry.acertos += 1;
    porMateria.set(nome, entry);
  }
  const materias: ExamMateria[] = [...porMateria.entries()]
    .map(([nome, v]) => ({
      nome,
      total: v.total,
      pct: v.total > 0 ? Math.round((v.acertos / v.total) * 100) : 0,
    }))
    .sort((a, b) => a.pct - b.pct);

  // Causas (metacognição) — só erros classificados
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

  // Conhecimentos exigidos com mais erro nesta prova
  const porConhecimento = new Map<string, { texto: string; erros: number }>();
  for (const a of incorretas) {
    const raw = a.provaQuestao?.conhecimentoExigido?.trim();
    if (!raw || raw.length < 8) continue;
    const chave = normaliza(raw);
    const entry = porConhecimento.get(chave) ?? {
      texto: raw.length > 140 ? `${raw.slice(0, 137)}…` : raw,
      erros: 0,
    };
    entry.erros += 1;
    porConhecimento.set(chave, entry);
  }
  const conhecimentos: ExamConhecimento[] = [...porConhecimento.values()]
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
    materias,
    causas,
    conhecimentos,
  };
}
