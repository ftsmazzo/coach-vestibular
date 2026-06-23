import type { ResultadoClassificacao } from "@/lib/conhecimento-catalog/types";
import { idFallbackNaoClassificado } from "@/lib/conhecimento-catalog/load";
import type { Classificacao, MetodoClassificacao } from "./types";
import {
  catalogoVersaoDeEscopo,
  derivarClassNode,
  resolverConceitoCanonic,
} from "./derivar-class-node";

type BuildClassificacaoInput = {
  resultado: ResultadoClassificacao;
  metodo?: MetodoClassificacao;
  classificadoEm?: string;
  versaoClassificador?: string;
};

/** Monta Classificacao canônica a partir do resultado do classificador v11. */
export function buildClassificacaoFromResultado(
  input: BuildClassificacaoInput
): Classificacao | null {
  const { resultado, metodo = "ia", classificadoEm = new Date().toISOString() } = input;
  const escopoId = resultado.escopoId;
  if (!escopoId) return null;

  const primario = derivarClassNode(escopoId, resultado.confianca);
  if (!primario) return null;

  const secundarios = (resultado.escoposSecundarios ?? [])
    .map((s) => derivarClassNode(s.escopoId, s.confianca))
    .filter((n): n is NonNullable<typeof n> => n !== null);

  const conceitos = new Set<string>();
  for (const id of resolverConceitoCanonic(escopoId)) conceitos.add(id);
  if (resultado.conceitoCanonic) conceitos.add(resultado.conceitoCanonic);
  for (const s of resultado.escoposSecundarios ?? []) {
    for (const id of resolverConceitoCanonic(s.escopoId)) conceitos.add(id);
  }

  const fallbackId = resultado.materiaId
    ? idFallbackNaoClassificado(resultado.materiaId)
    : null;
  const naoClassificado =
    resultado.status === "unclassified" ||
    escopoId === fallbackId ||
    escopoId.endsWith(".__nao_classificado");

  const catalogoVersao =
    catalogoVersaoDeEscopo(escopoId) ??
    (resultado.materiaId ? `${resultado.materiaId}@?` : "?");

  const n3 = resultado.conhecimentoExigido
    ? [resultado.conhecimentoExigido]
    : [];

  return {
    primario,
    secundarios,
    conceitoCanonic: [...conceitos],
    conhecimentoExigidoN3: n3,
    metodo,
    confiancaGlobal: resultado.confianca,
    revisao: {
      status:
        resultado.status === "review" || resultado.sinalizadorRevisao
          ? "pendente"
          : "aprovado",
    },
    classificadoEm,
    catalogoVersao: input.versaoClassificador ?? catalogoVersao,
    naoClassificado,
  };
}
