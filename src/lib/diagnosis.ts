import type { ErrorType } from "@/generated/prisma/client";
import { getMateriaLabel, getTemaLabel } from "./taxonomy";

export interface TemaScore {
  materiaId: string;
  temaId: string;
  materiaLabel: string;
  temaLabel: string;
  total: number;
  erros: number;
  acertos: number;
  taxaAcerto: number;
  tendencia?: "up" | "down" | "stable";
}

export interface MateriaScore {
  materiaId: string;
  materiaLabel: string;
  total: number;
  erros: number;
  taxaAcerto: number;
}

export interface DiagnosisResult {
  overallAcerto: number;
  materiaScores: MateriaScore[];
  temaScores: TemaScore[];
  focos: Array<{
    materiaId: string;
    temaId: string;
    label: string;
    prioridade: "alta" | "media";
    motivo: string;
    tipoErroDominante?: string;
    assunto?: string;
    conhecimentoExigido?: string | null;
    nivelDificuldade?: string | null;
    numerosErrados?: number[];
  }>;
  /** Agregação pedagógica da prova (matéria/assunto do banco) */
  resumoProva?: import("./diagnosis-prova").ResumoProvaDiagnostico;
  fortes: string[];
  fracos: string[];
  recoveryMode: boolean;
  mensagem: string;
  tipoErroCounts: Record<string, number>;
}

export interface AttemptInput {
  numero: number;
  correto: boolean;
  materiaId?: string | null;
  temaId?: string | null;
  tipoErro?: ErrorType | null;
}

function computeTemaScores(attempts: AttemptInput[]): TemaScore[] {
  const map = new Map<string, TemaScore>();

  for (const a of attempts) {
    if (!a.materiaId || !a.temaId) continue;
    const key = `${a.materiaId}:${a.temaId}`;
    const existing = map.get(key) ?? {
      materiaId: a.materiaId,
      temaId: a.temaId,
      materiaLabel: getMateriaLabel(a.materiaId),
      temaLabel: getTemaLabel(a.materiaId, a.temaId),
      total: 0,
      erros: 0,
      acertos: 0,
      taxaAcerto: 0,
    };
    existing.total++;
    if (a.correto) existing.acertos++;
    else existing.erros++;
    existing.taxaAcerto = existing.total > 0 ? existing.acertos / existing.total : 0;
    map.set(key, existing);
  }

  return Array.from(map.values()).sort((a, b) => a.taxaAcerto - b.taxaAcerto);
}

function computeMateriaScores(attempts: AttemptInput[]): MateriaScore[] {
  const map = new Map<string, MateriaScore>();

  for (const a of attempts) {
    if (!a.materiaId) continue;
    const existing = map.get(a.materiaId) ?? {
      materiaId: a.materiaId,
      materiaLabel: getMateriaLabel(a.materiaId),
      total: 0,
      erros: 0,
      taxaAcerto: 0,
    };
    existing.total++;
    if (!a.correto) existing.erros++;
    existing.taxaAcerto =
      existing.total > 0 ? (existing.total - existing.erros) / existing.total : 0;
    map.set(a.materiaId, existing);
  }

  return Array.from(map.values()).sort((a, b) => b.taxaAcerto - a.taxaAcerto);
}

function inferTipoErro(attempts: AttemptInput[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const a of attempts) {
    if (a.correto || !a.tipoErro) continue;
    counts[a.tipoErro] = (counts[a.tipoErro] ?? 0) + 1;
  }
  return counts;
}

function detectRecoveryMode(overallAcerto: number, checkIn?: number | null) {
  return overallAcerto < 0.45 || (checkIn !== undefined && checkIn !== null && checkIn <= 2);
}

export function buildDiagnosis(
  currentAttempts: AttemptInput[],
  historicalAttempts: AttemptInput[][],
  options?: { checkInScore?: number | null; examLabel?: string }
): DiagnosisResult {
  const total = currentAttempts.length;
  const acertos = currentAttempts.filter((a) => a.correto).length;
  const overallAcerto = total > 0 ? acertos / total : 0;

  const temaScores = computeTemaScores(currentAttempts);
  const materiaScores = computeMateriaScores(currentAttempts);
  const tipoErroCounts = inferTipoErro(currentAttempts);

  const temaRecurrence = new Map<string, number>();
  for (const hist of historicalAttempts) {
    for (const a of hist) {
      if (!a.correto && a.materiaId && a.temaId) {
        const key = `${a.materiaId}:${a.temaId}`;
        temaRecurrence.set(key, (temaRecurrence.get(key) ?? 0) + 1);
      }
    }
  }
  for (const a of currentAttempts) {
    if (!a.correto && a.materiaId && a.temaId) {
      const key = `${a.materiaId}:${a.temaId}`;
      temaRecurrence.set(key, (temaRecurrence.get(key) ?? 0) + 1);
    }
  }

  const focos = temaScores
    .filter((t) => t.erros > 0)
    .slice(0, 5)
    .map((t) => {
      const key = `${t.materiaId}:${t.temaId}`;
      const rec = temaRecurrence.get(key) ?? 0;
      const errosTema = currentAttempts.filter(
        (a) => !a.correto && a.materiaId === t.materiaId && a.temaId === t.temaId
      );
      const tipos = errosTema.map((e) => e.tipoErro).filter(Boolean) as ErrorType[];
      const tipoDominante = tipos.sort(
        (a, b) =>
          tipos.filter((x) => x === b).length - tipos.filter((x) => x === a).length
      )[0];

      return {
        materiaId: t.materiaId,
        temaId: t.temaId,
        label: `${t.materiaLabel} — ${t.temaLabel}`,
        prioridade: (rec >= 2 || t.taxaAcerto < 0.4 ? "alta" : "media") as "alta" | "media",
        motivo:
          rec >= 2
            ? `Errou este tema em ${rec} registros recentes`
            : `${Math.round((1 - t.taxaAcerto) * 100)}% de erro neste registro`,
        tipoErroDominante: tipoDominante,
      };
    })
    .sort((a, b) => (a.prioridade === "alta" ? -1 : 1))
    .slice(0, 3);

  const fortes = materiaScores.filter((m) => m.taxaAcerto >= 0.7).map((m) => m.materiaLabel);
  const fracos = materiaScores.filter((m) => m.taxaAcerto < 0.55).map((m) => m.materiaLabel);

  const recoveryMode = detectRecoveryMode(overallAcerto, options?.checkInScore);

  const errosSemTema = currentAttempts.filter(
    (a) => !a.correto && (!a.materiaId || !a.temaId)
  ).length;

  const focosFromMateria = materiaScores
    .filter((m) => m.erros > 0 && m.taxaAcerto < 0.55)
    .slice(0, 3)
    .map((m) => ({
      materiaId: m.materiaId,
      temaId: "geral",
      label: m.materiaLabel,
      prioridade: "media" as const,
      motivo: `${m.erros} erro(s) nesta área (estimativa por bloco da prova)`,
    }));

  const focosFinal = focos.length > 0 ? focos : focosFromMateria;
  const focosTexto = focosFinal
    .map((f) => f.label.split(" — ")[1] ?? f.label)
    .join(", ");
  const melhoraMateria = materiaScores.find((m) => m.taxaAcerto >= 0.65);

  const rotulo =
    options?.examLabel === "prova oficial"
      ? {
          este: "Esta prova oficial",
          neste: "Nesta prova oficial",
          comparar: "suas últimas provas oficiais",
        }
      : {
          este: "Este simulado",
          neste: "Neste simulado",
          comparar: "seus últimos simulados",
        };

  let mensagem: string;
  if (recoveryMode) {
    mensagem =
      `${rotulo.este} foi pesada — e isso não define seu vestibular. ` +
      `Um passo de cada vez: esta semana foque em no máximo ${focosFinal.length || 2} temas (` +
      `${focosTexto || "revisão leve"}). ` +
      `Você já demonstrou capacidade${melhoraMateria ? ` em ${melhoraMateria.materiaLabel}` : ""}. Respire, revise com calma.`;
  } else {
    const pct = Math.round(overallAcerto * 100);
    mensagem =
      `${rotulo.neste} você acertou ${pct}% das questões registradas. ` +
      (fortes.length ? `Pontos fortes: ${fortes.join(", ")}. ` : "") +
      (focosTexto ? `Focos da semana: ${focosTexto}. ` : "") +
      `Compare com ${rotulo.comparar} — a tendência importa mais que uma nota isolada.`;
  }

  if (errosSemTema > 0 && focos.length === 0) {
    mensagem +=
      ` Para diagnóstico por tema, registre o gabarito completo (número + letra) ou envie o caderno na Fase 2.`;
  }

  return {
    overallAcerto,
    materiaScores,
    temaScores,
    focos: focosFinal,
    fortes,
    fracos,
    recoveryMode,
    mensagem,
    tipoErroCounts,
  };
}

export function computeTrend(
  current: TemaScore[],
  previous: TemaScore[] | null
): TemaScore[] {
  if (!previous) return current;
  return current.map((t) => {
    const prev = previous.find(
      (p) => p.materiaId === t.materiaId && p.temaId === t.temaId
    );
    if (!prev) return { ...t, tendencia: "stable" as const };
    const diff = t.taxaAcerto - prev.taxaAcerto;
    return {
      ...t,
      tendencia: diff > 0.05 ? "up" : diff < -0.05 ? "down" : "stable",
    };
  });
}
