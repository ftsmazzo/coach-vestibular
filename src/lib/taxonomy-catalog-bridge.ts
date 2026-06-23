import bridgeData from "../../data/taxonomy-catalog-bridge.json";
import type { MateriaCorpusId } from "@/lib/enem-corpus-materia";

export type TaxonomyCatalogBridge = {
  schemaVersion: string;
  notas?: string;
  materiaParaCatalogo: Record<
    string,
    {
      catalogMateriaId: MateriaCorpusId;
      trilhaCatalogo?: "pt" | "l2_en" | "l2_es";
    }
  >;
  temaParaCatalogo: Array<{
    taxonomyMateriaId: string;
    temaId: string;
    catalogAssuntoId?: string;
    catalogDominioPrefix?: string;
    /** Segmento que deve aparecer no escopo N2 (ex.: geometria_ → geometria_plana, geometria_espacial). */
    catalogEscopoContem?: string;
  }>;
};

const bridge = bridgeData as TaxonomyCatalogBridge;

export type ResolucaoTaxonomyParaCatalogo = {
  taxonomyMateriaId: string;
  temaId?: string;
  catalogMateriaId: MateriaCorpusId;
  catalogAssuntoId?: string;
  catalogDominioPrefix?: string;
  catalogEscopoContem?: string;
  trilhaCatalogo?: "pt" | "l2_en" | "l2_es";
};

/** Simulado/diagnóstico → classificador corpus (N1/N2). */
export function taxonomyParaCatalogo(
  taxonomyMateriaId: string,
  temaId?: string | null
): ResolucaoTaxonomyParaCatalogo | null {
  const mat = bridge.materiaParaCatalogo[taxonomyMateriaId];
  if (!mat) return null;

  const base: ResolucaoTaxonomyParaCatalogo = {
    taxonomyMateriaId,
    temaId: temaId ?? undefined,
    catalogMateriaId: mat.catalogMateriaId,
    trilhaCatalogo: mat.trilhaCatalogo,
  };

  if (!temaId) return base;

  const tema = bridge.temaParaCatalogo.find(
    (t) => t.taxonomyMateriaId === taxonomyMateriaId && t.temaId === temaId
  );
  if (!tema) return base;

  return {
    ...base,
    catalogAssuntoId: tema.catalogAssuntoId,
    catalogDominioPrefix: tema.catalogDominioPrefix,
    catalogEscopoContem: tema.catalogEscopoContem,
  };
}

/** Escopo N2 classificado → taxonomia grossa (relatórios de jornada). */
export function escopoIdParaTaxonomy(
  escopoId: string,
  catalogMateriaId: MateriaCorpusId
): { materiaId: string; temaId?: string } | null {
  for (const [taxonomyMateriaId, map] of Object.entries(bridge.materiaParaCatalogo)) {
    if (map.catalogMateriaId !== catalogMateriaId) continue;

    for (const t of bridge.temaParaCatalogo) {
      if (t.taxonomyMateriaId !== taxonomyMateriaId) continue;
      if (t.catalogAssuntoId && escopoId.includes(`.${t.catalogAssuntoId}.`)) {
        return { materiaId: taxonomyMateriaId, temaId: t.temaId };
      }
      if (t.catalogDominioPrefix && escopoId.startsWith(`${t.catalogDominioPrefix}.`)) {
        return { materiaId: taxonomyMateriaId, temaId: t.temaId };
      }
      if (t.catalogEscopoContem && escopoId.includes(t.catalogEscopoContem)) {
        return { materiaId: taxonomyMateriaId, temaId: t.temaId };
      }
      if (t.catalogAssuntoId && escopoId.endsWith(`.${t.catalogAssuntoId}`)) {
        return { materiaId: taxonomyMateriaId, temaId: t.temaId };
      }
    }

    return { materiaId: taxonomyMateriaId };
  }
  return null;
}

export function carregarTaxonomyCatalogBridge(): TaxonomyCatalogBridge {
  return bridge;
}
