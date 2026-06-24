import type { ErrorType } from "@/generated/prisma/client";
import type { AttemptInput } from "@/lib/diagnosis";
import {
  parseClassificacaoSecundarios,
  parseJsonStringArray,
} from "@/lib/json-snapshot-utils";
import { parseMetadadosCognitivos } from "@/lib/metadados-cognitivos";
import { taxonomyFromQuestao } from "@/lib/canonical-question/taxonomy-from-questao";

/** Linha mínima de QuestionAttempt + ProvaQuestao para reconstruir AttemptInput. */
export type QuestionAttemptRow = {
  numero: number;
  correto: boolean;
  materiaId?: string | null;
  temaId?: string | null;
  tipoErro?: ErrorType | null;
  observacao?: string | null;
  respostaAluno?: string | null;
  conhecimentoDominioId?: string | null;
  conhecimentoEscopoId?: string | null;
  conhecimentoExigido?: string | null;
  classificacaoVersao?: string | null;
  classificacaoConfianca?: number | null;
  conceitosCanonicosJson?: string | null;
  classificacaoSecundariosJson?: string | null;
  metadadosCognitivosJson?: string | null;
  materiaCorrigida?: string | null;
  assuntoCorrigido?: string | null;
  provaQuestao?: {
    materia?: string;
    assunto?: string;
    conhecimentoDominioId?: string | null;
    conhecimentoEscopoId?: string | null;
    conhecimentoExigido?: string | null;
    classificacaoVersao?: string | null;
    classificacaoConfianca?: number | null;
    conceitosCanonicosJson?: string | null;
    classificacaoSecundariosJson?: string | null;
  } | null;
};

export function mapQuestionAttemptToInput(a: QuestionAttemptRow): AttemptInput {
  const pq = a.provaQuestao;
  const mapped =
    pq &&
    taxonomyFromQuestao({
      materia: pq.materia ?? "",
      assunto: pq.assunto ?? "",
      conhecimentoEscopoId: pq.conhecimentoEscopoId,
    });

  const escopoId =
    a.conhecimentoEscopoId ?? pq?.conhecimentoEscopoId ?? null;
  const conceitosRaw = a.conceitosCanonicosJson ?? pq?.conceitosCanonicosJson;
  const secundariosRaw =
    a.classificacaoSecundariosJson ?? pq?.classificacaoSecundariosJson;

  return {
    numero: a.numero,
    correto: a.correto,
    materiaId: a.materiaId ?? mapped?.materiaId,
    temaId: a.temaId ?? mapped?.temaId,
    tipoErro: a.tipoErro,
    observacao: a.observacao ?? undefined,
    respostaAluno: a.respostaAluno ?? undefined,
    conhecimentoDominioId:
      a.conhecimentoDominioId ?? pq?.conhecimentoDominioId ?? null,
    conhecimentoEscopoId: escopoId,
    conhecimentoExigido:
      a.conhecimentoExigido ?? pq?.conhecimentoExigido ?? null,
    classificacaoVersao:
      a.classificacaoVersao ?? pq?.classificacaoVersao ?? null,
    classificacaoConfianca:
      a.classificacaoConfianca ?? pq?.classificacaoConfianca ?? null,
    conceitosCanonicos: parseJsonStringArray(conceitosRaw),
    classificacaoSecundarios: parseClassificacaoSecundarios(secundariosRaw),
    metadadosCognitivos: parseMetadadosCognitivos(a.metadadosCognitivosJson),
  };
}

export type ProvaQuestaoSnapshot = {
  id: string;
  numero: number;
  materia: string;
  assunto: string;
  conhecimentoDominioId?: string | null;
  conhecimentoEscopoId?: string | null;
  conhecimentoExigido?: string | null;
  classificacaoVersao?: string | null;
  classificacaoConfianca?: number | null;
  conceitosCanonicosJson?: string | null;
  classificacaoSecundariosJson?: string | null;
  gabarito: string | null;
};

export function snapshotFromProvaQuestao(q: ProvaQuestaoSnapshot) {
  return {
    conhecimentoDominioId: q.conhecimentoDominioId ?? null,
    conhecimentoEscopoId: q.conhecimentoEscopoId ?? null,
    conhecimentoExigido: q.conhecimentoExigido ?? null,
    classificacaoVersao: q.classificacaoVersao ?? null,
    classificacaoConfianca: q.classificacaoConfianca ?? null,
    conceitosCanonicosJson: q.conceitosCanonicosJson ?? null,
    classificacaoSecundariosJson: q.classificacaoSecundariosJson ?? null,
    conceitosCanonicos: parseJsonStringArray(q.conceitosCanonicosJson),
    classificacaoSecundarios: parseClassificacaoSecundarios(
      q.classificacaoSecundariosJson
    ),
  };
}
