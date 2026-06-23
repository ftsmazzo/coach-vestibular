import type { ResultadoClassificacao } from "@/lib/conhecimento-catalog/types";
import type { CamposClassificacaoPersistidos } from "./types";
import { buildClassificacaoFromResultado } from "./build-classificacao";
import { labelMateriaCorpus } from "@/lib/conhecimento-catalog/load";

/** Converte ResultadoClassificacao → campos Prisma (ProvaQuestao / EnemQuestaoCorpus). */
export function camposClassificacaoFromResultado(
  resultado: ResultadoClassificacao,
  versaoClassificador: string
): CamposClassificacaoPersistidos & { materiaLabel?: string; assuntoId?: string } {
  const classificacao = buildClassificacaoFromResultado({
    resultado,
    versaoClassificador,
  });

  const temN2 =
    (resultado.status === "classified" || resultado.status === "review") &&
    resultado.escopoId;

  if (!temN2 || !classificacao) {
    return {
      conhecimentoEscopoId: null,
      conhecimentoDominioId: null,
      conhecimentoExigido: resultado.conhecimentoExigido ?? null,
      classificacaoVersao: versaoClassificador,
      classificacaoConfianca: resultado.confianca || null,
      classificacaoSecundariosJson: null,
      conceitosCanonicosJson: null,
    };
  }

  const secundarios = classificacao.secundarios.map((s) => ({
    escopoId: s.escopoId,
    confianca: s.confianca,
  }));

  return {
    conhecimentoEscopoId: classificacao.primario.escopoId,
    conhecimentoDominioId: classificacao.primario.dominioId,
    conhecimentoExigido: resultado.conhecimentoExigido ?? null,
    classificacaoVersao: versaoClassificador,
    classificacaoConfianca: classificacao.confiancaGlobal,
    classificacaoSecundariosJson:
      secundarios.length > 0 ? JSON.stringify(secundarios) : null,
    conceitosCanonicosJson:
      classificacao.conceitoCanonic.length > 0
        ? JSON.stringify(classificacao.conceitoCanonic)
        : null,
    materiaLabel: labelMateriaCorpus(classificacao.primario.materiaId),
    assuntoId: classificacao.primario.assuntoId,
  };
}
