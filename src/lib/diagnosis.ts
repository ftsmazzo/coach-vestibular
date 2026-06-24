import type { ErrorType, ModoUsoRegistro } from "@/generated/prisma/client";
import { pesoModoUso } from "@/lib/modo-uso";
import { getMateriaLabel, getTemaLabel } from "./taxonomy";
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

export interface TemaScore {
  materiaId: string;
  temaId: string;
  materiaLabel: string;
  temaLabel: string;
  total: number;
  erros: number;
  acertos: number;
  taxaAcerto: number;
  vulnerabilidade?: number;
  tendencia?: "up" | "down" | "stable";
}

export interface MateriaScore {
  materiaId: string;
  materiaLabel: string;
  total: number;
  erros: number;
  taxaAcerto: number;
  vulnerabilidade?: number;
}

export interface DiagnosisResult {
  overallAcerto: number;
  materiaScores: MateriaScore[];
  temaScores: TemaScore[];
  /** Eixo principal do motor v1 — desempenho por escopo N2 */
  escopoScores?: EscopoScore[];
  focosPedagogicos?: FocoPedagogico[];
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
  aiStudyPlanItems?: StudyPlanItem[];
  /** ia = GPT ok; fallback_local = formato novo sem API; legado = generateStudyPlan */
  planoCoachStatus?: "ia" | "fallback_local" | "legado";
  planoCoachAviso?: string;
}

export interface AttemptInput {
  numero: number;
  correto: boolean;

  /** legado/UI */
  materiaId?: string | null;
  temaId?: string | null;

  /** classificação fina (snapshot da ProvaQuestao) */
  conhecimentoDominioId?: string | null;
  conhecimentoEscopoId?: string | null;
  conhecimentoExigido?: string | null;
  conceitosCanonicos?: string[];
  classificacaoVersao?: string | null;
  classificacaoConfianca?: number | null;
  classificacaoSecundarios?: ClassificacaoSecundaria[];

  /** erro do aluno */
  tipoErro?: ErrorType | null;
  observacao?: string | null;
  metadadosCognitivos?: MetadadosCognitivosErro | null;

  /** auditoria */
  provaQuestaoId?: string;
  respostaAluno?: string | null;
}

function getProvaTipoWeight(tipo?: string | null): number {
  if (tipo === "ENEM_OFICIAL" || tipo === "VESTIBULAR") return 3;
  if (tipo === "SIMULADO") return 2;
  if (tipo === "LISTA_FIXACAO") return 1;
  return 2;
}

function computeTemaScores(attempts: AttemptInput[], weight: number): TemaScore[] {
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
      vulnerabilidade: 0,
    };
    existing.total++;
    if (a.correto) existing.acertos++;
    else existing.erros++;
    existing.taxaAcerto = existing.total > 0 ? existing.acertos / existing.total : 0;
    
    // Weighted vulnerability calculation
    const weightedErrors = existing.erros * weight;
    const weightedTotal = existing.total * weight;
    existing.vulnerabilidade = weightedTotal > 0 ? weightedErrors / weightedTotal : 0;
    
    map.set(key, existing);
  }

  return Array.from(map.values()).sort((a, b) => a.taxaAcerto - b.taxaAcerto);
}

function computeMateriaScores(attempts: AttemptInput[], weight: number): MateriaScore[] {
  const map = new Map<string, MateriaScore>();

  for (const a of attempts) {
    if (!a.materiaId) continue;
    const existing = map.get(a.materiaId) ?? {
      materiaId: a.materiaId,
      materiaLabel: getMateriaLabel(a.materiaId),
      total: 0,
      erros: 0,
      taxaAcerto: 0,
      vulnerabilidade: 0,
    };
    existing.total++;
    if (!a.correto) existing.erros++;
    existing.taxaAcerto =
      existing.total > 0 ? (existing.total - existing.erros) / existing.total : 0;
      
    // Weighted vulnerability calculation
    const weightedErrors = existing.erros * weight;
    const weightedTotal = existing.total * weight;
    existing.vulnerabilidade = weightedTotal > 0 ? weightedErrors / weightedTotal : 0;
    
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

// -------------------------------------------------------------
// HELPER FUNCTIONS FOR METACOGNITIVE OVERRIDES & AGGREGATION
// -------------------------------------------------------------

export interface GroupedError {
  materia: string;
  tema: string;
  materiaId: string;
  temaId: string;
  errosCount: number;
  questoesNumeros: number[];
  causas: string[];
  anotacoes: string[];
}

function preprocessAttemptsWithOverrides(attempts: AttemptInput[]): AttemptInput[] {
  // Sprint 0: não reescrever matéria/tema por regex na observação do aluno.
  // A classificação canônica virá de ProvaQuestao.conhecimentoEscopoId (fase seguinte).
  return attempts;
}

function aggregateCurrentErrors(attempts: AttemptInput[]): GroupedError[] {
  const map = new Map<string, GroupedError>();

  for (const a of attempts) {
    if (a.correto) continue;
    const matId = a.materiaId || "geral";
    const temId = a.temaId || "geral";
    const key = `${matId}:${temId}`;
    
    const matLabel = getMateriaLabel(matId);
    const temLabel = getTemaLabel(matId, temId);
    
    const existing = map.get(key) ?? {
      materia: matLabel,
      tema: temLabel,
      materiaId: matId,
      temaId: temId,
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

  return Array.from(map.values());
}

function detectRecoveryMode(overallAcerto: number, checkIn?: number | null) {
  return overallAcerto < 0.45 || (checkIn !== undefined && checkIn !== null && checkIn <= 2);
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
  // Pre-process current and historical attempts with student's overrides
  const cleanCurrentAttempts = preprocessAttemptsWithOverrides(currentAttempts);
  const cleanHistoricalAttempts = historicalAttempts.map((hist) => preprocessAttemptsWithOverrides(hist));

  const total = cleanCurrentAttempts.length;
  const acertos = cleanCurrentAttempts.filter((a) => a.correto).length;
  const overallAcerto = total > 0 ? acertos / total : 0;

  const weight = options?.modoUso
    ? pesoModoUsoFromOptions(options.modoUso)
    : getProvaTipoWeight(options?.provaTipo);
  const temaScores = computeTemaScores(cleanCurrentAttempts, weight);
  const materiaScores = computeMateriaScores(cleanCurrentAttempts, weight);
  const tipoErroCounts = inferTipoErro(cleanCurrentAttempts);

  const temaRecurrence = new Map<string, number>();
  for (const hist of cleanHistoricalAttempts) {
    for (const a of hist) {
      if (!a.correto && a.materiaId && a.temaId) {
        const key = `${a.materiaId}:${a.temaId}`;
        temaRecurrence.set(key, (temaRecurrence.get(key) ?? 0) + 1);
      }
    }
  }
  for (const a of cleanCurrentAttempts) {
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
      const errosTema = cleanCurrentAttempts.filter(
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

  const errosSemTema = cleanCurrentAttempts.filter(
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

  const escopoScores = buildEscopoScores(cleanCurrentAttempts, cleanHistoricalAttempts, {
    weight,
    anamnese: options?.anamnese,
  });
  const focosPedagogicos = buildFocosPedagogicos(
    escopoScores,
    cleanCurrentAttempts,
    options?.anamnese
  ).slice(0, 3);

  /** Enriquece focos legados quando há escopo classificado */
  const focosEnriquecidos =
    focosPedagogicos.length > 0
      ? focosPedagogicos.map((fp) => ({
          materiaId: fp.materiaId,
          temaId: fp.escopoId,
          label: `${fp.materiaLabel} — ${fp.escopoLabel}`,
          prioridade: (fp.prioridade === "manutencao" ? "media" : fp.prioridade) as
            | "alta"
            | "media",
          motivo: fp.hipoteseCausa,
          tipoErroDominante: fp.tipoErroDominante ?? undefined,
          conhecimentoExigido: fp.conhecimentoExigido[0] ?? null,
          numerosErrados: fp.numerosErrados,
        }))
      : focosFinal;

  const focosTexto = (focosPedagogicos.length > 0 ? focosEnriquecidos : focosFinal)
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
    escopoScores,
    focosPedagogicos,
    focos: focosEnriquecidos,
    fortes,
    fracos,
    recoveryMode,
    mensagem,
    tipoErroCounts,
  };
}

/** Plano semanal via GPT (após diagnóstico enriquecido com resumo da prova). */
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
      focos: parsed.focos?.length ? parsed.focos : diagnosis.focos,
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
