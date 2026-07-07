/**
 * Resolução N1/N2/N3 para elegibilidade e pendências — attempt → ProvaQuestao → catálogo por número.
 */
import { parseClassificacaoN1 } from "@/lib/classificacao-n1-types";
import { escopoN2Real } from "@/lib/classificacao-n2-types";

export type AttemptClassificacao = {
  correto: boolean;
  n1CatalogoId: string | null;
  escopoId: string | null;
  conhecimentoExigido: string | null;
};

export type QuestaoCatalogoClassificacao = {
  classificacaoN1Json?: string | null;
  conhecimentoDominioId?: string | null;
  conhecimentoEscopoId?: string | null;
  conhecimentoExigido?: string | null;
  materia?: string | null;
};

export type AttemptClassificacaoRow = {
  correto: boolean;
  materiaId?: string | null;
  conhecimentoDominioId?: string | null;
  conhecimentoEscopoId?: string | null;
  conhecimentoExigido?: string | null;
  provaQuestao?: QuestaoCatalogoClassificacao | null;
};

/** Questão com classificação pedagógica completa (N1 + N2 real + N3). */
export function questaoTemN1N2N3(
  c: Pick<AttemptClassificacao, "n1CatalogoId" | "escopoId" | "conhecimentoExigido">
): boolean {
  const n1Ok = Boolean(c.n1CatalogoId?.trim());
  const n2Ok = escopoN2Real(c.escopoId);
  const n3Ok = Boolean(c.conhecimentoExigido?.trim());
  return n1Ok && n2Ok && n3Ok;
}

/** Erro com classificação suficiente para priorização (N1/N2/N3). */
export function erroAnalisavel(c: AttemptClassificacao): boolean {
  return !c.correto && questaoTemN1N2N3(c);
}

export function resolverClassificacaoAttempt(
  a: AttemptClassificacaoRow,
  catalogoPorNumero?: QuestaoCatalogoClassificacao | null
): AttemptClassificacao {
  const fonte = a.provaQuestao ?? catalogoPorNumero ?? null;
  const n1 = parseClassificacaoN1(fonte?.classificacaoN1Json);
  const escopoId = a.conhecimentoEscopoId ?? fonte?.conhecimentoEscopoId ?? null;
  const conhecimentoExigido = a.conhecimentoExigido ?? fonte?.conhecimentoExigido ?? null;
  const dominioId = a.conhecimentoDominioId ?? fonte?.conhecimentoDominioId ?? null;
  const n1CatalogoId =
    n1?.catalogoId ??
    dominioId?.split(".")[0] ??
    a.materiaId?.trim().toLowerCase() ??
    fonte?.materia?.trim().toLowerCase() ??
    null;

  return { correto: a.correto, n1CatalogoId, escopoId, conhecimentoExigido };
}

export function motivosPendenciaClassificacao(c: AttemptClassificacao): string[] {
  const motivos: string[] = [];
  if (!c.n1CatalogoId?.trim()) motivos.push("sem N1");
  if (!escopoN2Real(c.escopoId)) motivos.push("sem N2 real");
  if (!c.conhecimentoExigido?.trim()) motivos.push("sem N3");
  return motivos;
}

export function conhecimentoExigidoExibicao(
  attempt: { conhecimentoExigido?: string | null },
  provaQuestao?: { conhecimentoExigido?: string | null } | null
): string | null {
  return attempt.conhecimentoExigido?.trim() || provaQuestao?.conhecimentoExigido?.trim() || null;
}

export type CamposSnapshotClassificacao = {
  conhecimentoDominioId?: string | null;
  conhecimentoEscopoId?: string | null;
  conhecimentoExigido?: string | null;
  classificacaoVersao?: string | null;
  classificacaoConfianca?: number | null;
  conceitosCanonicosJson?: string | null;
  classificacaoSecundariosJson?: string | null;
};

export function montarAtualizacaoSnapshotClassificacao(
  attempt: CamposSnapshotClassificacao & { provaQuestaoId?: string | null },
  provaQuestao: CamposSnapshotClassificacao & { id?: string }
): { data: CamposSnapshotClassificacao & { provaQuestaoId?: string }; alterou: boolean } {
  const data: CamposSnapshotClassificacao & { provaQuestaoId?: string } = {};
  let alterou = false;

  const copiar = (
    campo: keyof CamposSnapshotClassificacao,
    valorPq: string | number | null | undefined
  ) => {
    if (valorPq == null || valorPq === "") return;
    const atual = attempt[campo];
    const novo = typeof valorPq === "number" ? valorPq : String(valorPq).trim();
    if (atual == null || atual === "" || atual === undefined) {
      (data as Record<string, unknown>)[campo] = novo;
      alterou = true;
    }
  };

  copiar("conhecimentoDominioId", provaQuestao.conhecimentoDominioId);
  copiar("conhecimentoEscopoId", provaQuestao.conhecimentoEscopoId);
  copiar("conhecimentoExigido", provaQuestao.conhecimentoExigido);
  copiar("classificacaoVersao", provaQuestao.classificacaoVersao);
  copiar("classificacaoConfianca", provaQuestao.classificacaoConfianca);
  copiar("conceitosCanonicosJson", provaQuestao.conceitosCanonicosJson);
  copiar("classificacaoSecundariosJson", provaQuestao.classificacaoSecundariosJson);

  if (provaQuestao.id && !attempt.provaQuestaoId?.trim()) {
    data.provaQuestaoId = provaQuestao.id;
    alterou = true;
  }

  return { data, alterou };
}
