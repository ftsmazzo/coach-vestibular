import type { ErrorType, ModoUsoRegistro } from "@/generated/prisma/client";
import type { AttemptInput } from "@/lib/diagnosis";
import type { MetadadosCognitivosErro } from "@/lib/metadados-cognitivos";
import { indexGlobalEscopos } from "@/lib/conhecimento-catalog/load";
import { getMateriaLabel } from "@/lib/taxonomy";

/** Evento de aprendizagem — átomo conceitual do motor v1. */
export type LearningErrorEvent = {
  examId?: string;
  examData?: Date;
  provaId?: string | null;
  provaQuestaoId?: string | null;
  numero: number;
  correto: boolean;
  respostaAluno?: string | null;
  gabarito?: string | null;
  materiaId?: string | null;
  materiaLabel?: string | null;
  temaId?: string | null;
  conhecimentoDominioId?: string | null;
  conhecimentoEscopoId?: string | null;
  escopoLabel?: string | null;
  conhecimentoExigido?: string | null;
  conceitosCanonicos?: string[];
  classificacaoVersao?: string | null;
  classificacaoConfianca?: number | null;
  tipoErro?: ErrorType | null;
  observacao?: string | null;
  metadadosCognitivos?: MetadadosCognitivosErro | null;
  modoUso?: ModoUsoRegistro;
  banca?: string | null;
  peso?: number;
};

export function attemptToLearningEvent(
  a: AttemptInput,
  ctx?: {
    examId?: string;
    provaQuestaoId?: string;
    gabarito?: string | null;
    peso?: number;
  }
): LearningErrorEvent {
  const escopos = indexGlobalEscopos();
  const escopoId = a.conhecimentoEscopoId?.trim() || null;
  const entry = escopoId ? escopos.get(escopoId) : undefined;

  return {
    examId: ctx?.examId,
    provaQuestaoId: ctx?.provaQuestaoId ?? a.provaQuestaoId ?? null,
    numero: a.numero,
    correto: a.correto,
    respostaAluno: a.respostaAluno ?? null,
    gabarito: ctx?.gabarito ?? null,
    materiaId: a.materiaId ?? entry?.materiaId ?? null,
    materiaLabel: a.materiaId
      ? getMateriaLabel(a.materiaId)
      : entry?.materiaId
        ? getMateriaLabel(entry.materiaId)
        : null,
    temaId: a.temaId ?? null,
    conhecimentoDominioId: a.conhecimentoDominioId ?? entry?.dominioId ?? null,
    conhecimentoEscopoId: escopoId,
    escopoLabel: entry?.escopoLabel ?? null,
    conhecimentoExigido: a.conhecimentoExigido ?? null,
    conceitosCanonicos: a.conceitosCanonicos ?? [],
    classificacaoVersao: a.classificacaoVersao ?? null,
    classificacaoConfianca: a.classificacaoConfianca ?? null,
    tipoErro: a.tipoErro ?? null,
    observacao: a.observacao ?? null,
    metadadosCognitivos: a.metadadosCognitivos ?? null,
    peso: ctx?.peso ?? 1,
  };
}

export function attemptsToLearningEvents(
  attempts: AttemptInput[],
  ctx?: { examId?: string; peso?: number }
): LearningErrorEvent[] {
  return attempts.map((a) =>
    attemptToLearningEvent(a, {
      examId: ctx?.examId,
      provaQuestaoId: a.provaQuestaoId,
      peso: ctx?.peso,
    })
  );
}
