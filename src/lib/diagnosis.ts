/**
 * Motor de diagnóstico v1 — fonte única de decisão: focosPedagogicos + escopoScores.
 * Consumidores de plano, copiloto, ciclo e Home devem ler focosPedagogicos, não matéria/tema legado.
 */
import type { ErrorType, ModoUsoRegistro } from "@/generated/prisma/client";
import { pesoModoUso } from "@/lib/modo-uso";
import { indexGlobalEscopos } from "@/lib/conhecimento-catalog/load";
import { getMateriaLabel } from "./taxonomy";
import type { ClassificacaoSecundaria } from "./json-snapshot-utils";
import type { MetadadosCognitivosErro } from "./metadados-cognitivos";
import {
  buildEscopoScores,
  buildFocosPedagogicos,
  type AnamneseContext,
  type EscopoScore,
  type FocoPedagogico,
} from "./diagnosis-escopo";
import type { StudyPlanItem } from "./study-plan";

function pesoModoUsoFromOptions(modo: ModoUsoRegistro): number {
  return pesoModoUso(modo);
}

export type { EscopoScore, FocoPedagogico, AnamneseContext };

export interface DiagnosisResult {
  overallAcerto: number;
  /** Eixo principal do motor v1 */
  escopoScores: EscopoScore[];
  focosPedagogicos: FocoPedagogico[];
  /** Agregação pedagógica da prova por escopo N2 */
  resumoProva?: import("./diagnosis-prova").ResumoProvaDiagnostico;
  fortes: string[];
  fracos: string[];
  recoveryMode: boolean;
  mensagem: string;
  tipoErroCounts: Record<string, number>;
  aiStudyPlanItems?: StudyPlanItem[];
  planoCoachStatus?: "ia" | "fallback_local";
  planoCoachAviso?: string;
}

export interface AttemptInput {
  numero: number;
  correto: boolean;
  materiaId?: string | null;
  temaId?: string | null;
  conhecimentoDominioId?: string | null;
  conhecimentoEscopoId?: string | null;
  conhecimentoExigido?: string | null;
  conceitosCanonicos?: string[];
  classificacaoVersao?: string | null;
  classificacaoConfianca?: number | null;
  classificacaoSecundarios?: ClassificacaoSecundaria[];
  tipoErro?: ErrorType | null;
  observacao?: string | null;
  metadadosCognitivos?: MetadadosCognitivosErro | null;
  provaQuestaoId?: string;
  respostaAluno?: string | null;
}

function getProvaTipoWeight(tipo?: string | null): number {
  if (tipo === "ENEM_OFICIAL" || tipo === "VESTIBULAR") return 3;
  if (tipo === "SIMULADO") return 2;
  if (tipo === "LISTA_FIXACAO") return 1;
  return 2;
}

function inferTipoErro(attempts: AttemptInput[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const a of attempts) {
    if (a.correto || !a.tipoErro) continue;
    counts[a.tipoErro] = (counts[a.tipoErro] ?? 0) + 1;
  }
  return counts;
}

export interface GroupedError {
  escopoId: string;
  escopoLabel: string;
  materiaLabel: string;
  errosCount: number;
  questoesNumeros: number[];
  causas: string[];
  anotacoes: string[];
}

function preprocessAttemptsWithOverrides(attempts: AttemptInput[]): AttemptInput[] {
  return attempts;
}

function resolveEscopoLabel(a: AttemptInput): { escopoId: string; escopoLabel: string; materiaLabel: string } {
  const escopoId = a.conhecimentoEscopoId?.trim() || "sem_escopo";
  const idx = indexGlobalEscopos();
  const meta = idx.get(escopoId);
  const materiaLabel = meta?.materiaId
    ? getMateriaLabel(meta.materiaId)
    : a.materiaId
      ? getMateriaLabel(a.materiaId)
      : "Geral";
  const escopoLabel = meta?.escopoLabel ?? a.conhecimentoExigido?.slice(0, 48) ?? escopoId;
  return { escopoId, escopoLabel, materiaLabel };
}

export function aggregateCurrentErrors(attempts: AttemptInput[]): GroupedError[] {
  const map = new Map<string, GroupedError>();

  for (const a of attempts) {
    if (a.correto) continue;
    const { escopoId, escopoLabel, materiaLabel } = resolveEscopoLabel(a);
    const key = escopoId;
    const existing = map.get(key) ?? {
      escopoId,
      escopoLabel,
      materiaLabel,
      errosCount: 0,
      questoesNumeros: [],
      causas: [],
      anotacoes: [],
    };
    existing.errosCount++;
    existing.questoesNumeros.push(a.numero);
    if (a.tipoErro) existing.causas.push(a.tipoErro);
    if (a.observacao) existing.anotacoes.push(`Q${a.numero}: "${a.observacao}"`);
    map.set(key, existing);
  }

  return Array.from(map.values()).sort((a, b) => b.errosCount - a.errosCount);
}

function detectRecoveryMode(overallAcerto: number, checkIn?: number | null) {
  return overallAcerto < 0.45 || (checkIn !== undefined && checkIn !== null && checkIn <= 2);
}

function fortesFracosFromEscopo(scores: EscopoScore[]): { fortes: string[]; fracos: string[] } {
  const porMateria = new Map<string, { total: number; acertos: number }>();
  for (const s of scores) {
    const m = porMateria.get(s.materiaLabel) ?? { total: 0, acertos: 0 };
    m.total += s.total;
    m.acertos += s.acertos;
    porMateria.set(s.materiaLabel, m);
  }
  const fortes: string[] = [];
  const fracos: string[] = [];
  for (const [label, agg] of porMateria) {
    const taxa = agg.total > 0 ? agg.acertos / agg.total : 0;
    if (taxa >= 0.7) fortes.push(label);
    else if (taxa < 0.55) fracos.push(label);
  }
  return { fortes, fracos };
}

export async function buildDiagnosis(
  currentAttempts: AttemptInput[],
  historicalAttempts: AttemptInput[][],
  options?: {
    checkInScore?: number | null;
    examLabel?: string;
    provaTipo?: string | null;
    modoUso?: ModoUsoRegistro | null;
    anamnese?: AnamneseContext;
  }
): Promise<DiagnosisResult> {
  const cleanCurrentAttempts = preprocessAttemptsWithOverrides(currentAttempts);
  const cleanHistoricalAttempts = historicalAttempts.map((hist) =>
    preprocessAttemptsWithOverrides(hist)
  );

  const total = cleanCurrentAttempts.length;
  const acertos = cleanCurrentAttempts.filter((a) => a.correto).length;
  const overallAcerto = total > 0 ? acertos / total : 0;

  const weight = options?.modoUso
    ? pesoModoUsoFromOptions(options.modoUso)
    : getProvaTipoWeight(options?.provaTipo);
  const tipoErroCounts = inferTipoErro(cleanCurrentAttempts);

  const escopoScores = buildEscopoScores(cleanCurrentAttempts, cleanHistoricalAttempts, {
    weight,
    anamnese: options?.anamnese,
  });
  const focosPedagogicos = buildFocosPedagogicos(
    escopoScores,
    cleanCurrentAttempts,
    options?.anamnese
  ).slice(0, 3);

  const { fortes, fracos } = fortesFracosFromEscopo(escopoScores);
  const recoveryMode = detectRecoveryMode(overallAcerto, options?.checkInScore);

  const focosTexto = focosPedagogicos.map((f) => f.escopoLabel).join(", ");
  const melhoraMateria = escopoScores.find((s) => s.taxaAcerto >= 0.65);

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
      `Um passo de cada vez: esta semana foque em no máximo ${focosPedagogicos.length || 2} escopos (` +
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

  const errosSemEscopo = cleanCurrentAttempts.filter(
    (a) => !a.correto && !a.conhecimentoEscopoId?.trim()
  ).length;
  if (errosSemEscopo > 0 && focosPedagogicos.length === 0) {
    mensagem +=
      " Classifique a prova no admin (escopo N2) para ativar o copiloto por escopo.";
  }

  return {
    overallAcerto,
    escopoScores,
    focosPedagogicos,
    fortes,
    fracos,
    recoveryMode,
    mensagem,
    tipoErroCounts,
  };
}

export function escopoScoresToMateriaLite(
  scores: EscopoScore[]
): Array<{ materiaId: string; taxaAcerto: number; erros: number }> {
  const map = new Map<string, { total: number; acertos: number; erros: number }>();
  for (const s of scores) {
    const m = map.get(s.materiaId) ?? { total: 0, acertos: 0, erros: 0 };
    m.total += s.total;
    m.acertos += s.acertos;
    m.erros += s.erros;
    map.set(s.materiaId, m);
  }
  return [...map.entries()].map(([materiaId, agg]) => ({
    materiaId,
    taxaAcerto: agg.total > 0 ? agg.acertos / agg.total : 0,
    erros: agg.erros,
  }));
}

export async function aplicarPlanoCoachIA(
  diagnosis: DiagnosisResult,
  attempts: AttemptInput[],
  options?: { checkInScore?: number | null; examLabel?: string }
): Promise<DiagnosisResult> {
  const {
    gerarPlanoComCoachIA,
    planoCoachParaStudyItems,
    planoCoachFallbackLocal,
  } = await import("./plano-coach-ia");
  const grouped = aggregateCurrentErrors(preprocessAttemptsWithOverrides(attempts));
  const { parsed, erroIa } = await gerarPlanoComCoachIA({
    diagnosis,
    groupedErrors: grouped,
    overallAcerto: diagnosis.overallAcerto,
    recoveryMode: diagnosis.recoveryMode,
    checkInScore: options?.checkInScore,
    examLabel: options?.examLabel,
  });

  if (parsed) {
    return {
      ...diagnosis,
      mensagem: parsed.mensagemResumo || diagnosis.mensagem,
      aiStudyPlanItems: planoCoachParaStudyItems(parsed, diagnosis),
      planoCoachStatus: "ia",
    };
  }

  const avisoBase = erroIa ?? "IA indisponível";
  const items = planoCoachFallbackLocal(diagnosis, grouped);
  return {
    ...diagnosis,
    aiStudyPlanItems: items,
    planoCoachStatus: "fallback_local",
    planoCoachAviso: `${avisoBase}. Plano montado com seus dados da prova — formato novo ativo.`,
  };
}
