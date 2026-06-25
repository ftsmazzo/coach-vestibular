import "server-only";

import { parseClassificacaoN1 } from "@/lib/classificacao-n1-types";
import { indexGlobalEscopos } from "@/lib/conhecimento-catalog/load";
import { resolverCatalogoN1Questao } from "@/lib/resolver-catalogo-n1-questao";
import { opcoesCatalogoN1 } from "@/lib/catalogos-n1-destino";

export type { ClassificacaoTresNiveis } from "@/lib/escopo-display-client";

type FonteQuestao = {
  classificacaoN1Json?: string | null;
  classificacaoVersao?: string | null;
  materia?: string | null;
  conhecimentoEscopoId?: string | null;
  conhecimentoDominioId?: string | null;
  conhecimentoExigido?: string | null;
  classificacaoConfianca?: number | null;
};

export function labelEscopo(escopoId: string | null | undefined): string | null {
  if (!escopoId?.trim()) return null;
  const entry = indexGlobalEscopos().get(escopoId);
  return entry?.escopoLabel ?? escopoId;
}

export function formatClassificacaoTresNiveis(q: FonteQuestao) {
  const escopoId = q.conhecimentoEscopoId?.trim() || null;
  const idx = escopoId ? indexGlobalEscopos().get(escopoId) : null;
  const n1 = parseClassificacaoN1(q.classificacaoN1Json);
  const catalogoId = resolverCatalogoN1Questao(q);
  const catalogo = opcoesCatalogoN1().find((c) => c.id === catalogoId);

  return {
    n1Area: n1?.area ?? catalogo?.area ?? idx?.areaEnem ?? null,
    n1Catalogo: catalogo?.label ?? n1?.catalogoId ?? null,
    n2EscopoId: escopoId,
    n2EscopoLabel: idx?.escopoLabel ?? labelEscopo(escopoId),
    n2DominioId: q.conhecimentoDominioId ?? idx?.dominioId ?? null,
    n3Conhecimento: q.conhecimentoExigido?.trim() || null,
    confianca: q.classificacaoConfianca ?? null,
  };
}

export function buscarEscoposPorTexto(query: string, limit = 20): Array<{
  id: string;
  label: string;
  areaEnem?: string;
  catalogVersion: string;
}> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const out: Array<{
    id: string;
    label: string;
    areaEnem?: string;
    catalogVersion: string;
    score: number;
  }> = [];

  for (const [id, entry] of indexGlobalEscopos()) {
    const label = entry.escopoLabel.toLowerCase();
    const idLower = id.toLowerCase();
    let score = 0;
    if (idLower === q) score = 100;
    else if (idLower.startsWith(q)) score = 80;
    else if (label.startsWith(q)) score = 70;
    else if (label.includes(q)) score = 50;
    else if (idLower.includes(q)) score = 40;
    if (score > 0) {
      out.push({
        id,
        label: entry.escopoLabel,
        areaEnem: entry.areaEnem,
        catalogVersion: entry.catalogVersion,
        score,
      });
    }
  }

  return out
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, "pt-BR"))
    .slice(0, limit)
    .map(({ score: _s, ...rest }) => rest);
}
