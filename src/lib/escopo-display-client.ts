import { parseClassificacaoN1 } from "@/lib/classificacao-n1-types";
import { opcoesCatalogoN1 } from "@/lib/catalogos-n1-destino";
import { resolverCatalogoN1Questao } from "@/lib/resolver-catalogo-n1-questao";

export type ClassificacaoTresNiveis = {
  n1Area: string | null;
  n1Catalogo: string | null;
  n2EscopoId: string | null;
  n2EscopoLabel: string | null;
  n2DominioId: string | null;
  n3Conhecimento: string | null;
  confianca: number | null;
};

/** Label curto derivado do id — seguro para Client Components (sem catálogo em disco). */
export function labelEscopoCurto(escopoId: string | null | undefined): string | null {
  if (!escopoId?.trim()) return null;
  const parts = escopoId.split(".");
  return parts[parts.length - 1]?.replace(/_/g, " ") ?? escopoId;
}

type FonteQuestaoCliente = {
  classificacaoN1Json?: string | null;
  classificacaoVersao?: string | null;
  materia?: string | null;
  conhecimentoEscopoId?: string | null;
  conhecimentoDominioId?: string | null;
  conhecimentoExigido?: string | null;
  classificacaoConfianca?: number | null;
  /** Label N2 já resolvido no servidor (opcional). */
  escopoLabel?: string | null;
};

export function formatClassificacaoTresNiveis(q: FonteQuestaoCliente): ClassificacaoTresNiveis {
  const escopoId = q.conhecimentoEscopoId?.trim() || null;
  const n1 = parseClassificacaoN1(q.classificacaoN1Json);
  const catalogoId = resolverCatalogoN1Questao(q);
  const catalogo = opcoesCatalogoN1().find((c) => c.id === catalogoId);

  return {
    n1Area: n1?.area ?? catalogo?.area ?? null,
    n1Catalogo: catalogo?.label ?? n1?.catalogoId ?? null,
    n2EscopoId: escopoId,
    n2EscopoLabel: q.escopoLabel?.trim() || labelEscopoCurto(escopoId),
    n2DominioId: q.conhecimentoDominioId ?? null,
    n3Conhecimento: q.conhecimentoExigido?.trim() || null,
    confianca: q.classificacaoConfianca ?? null,
  };
}
