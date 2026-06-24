import {
  indexGlobalEscopos,
  mapaConceitoPorEscopo,
  carregarConceitosCanonicos,
} from "@/lib/conhecimento-catalog/load";
import type { AreaEnem, ClassNode, CatalogMateriaId } from "./types";
import type { MateriaCorpusId } from "@/lib/enem-corpus-materia";

const AREAS_ENEM: AreaEnem[] = [
  "Ciências da Natureza",
  "Matemática",
  "Linguagens, Códigos e suas Tecnologias",
  "Ciências Humanas e suas Tecnologias",
];

function asAreaEnem(raw: string | undefined, materiaId: MateriaCorpusId): AreaEnem {
  if (raw && AREAS_ENEM.includes(raw as AreaEnem)) return raw as AreaEnem;
  const fallback: Record<MateriaCorpusId, AreaEnem> = {
    biologia: "Ciências da Natureza",
    quimica: "Ciências da Natureza",
    fisica: "Ciências da Natureza",
    natureza_transversal: "Ciências da Natureza",
    matematica: "Matemática",
    linguagens: "Linguagens, Códigos e suas Tecnologias",
    humanas: "Ciências Humanas e suas Tecnologias",
  };
  return fallback[materiaId];
}

/**
 * Deriva ClassNode a partir de escopoId (N2) consultando o índice global do catálogo.
 * Retorna null se o ID não existir ou estiver deprecated.
 */
export function derivarClassNode(
  escopoId: string,
  confianca = 1
): ClassNode | null {
  const entry = indexGlobalEscopos().get(escopoId);
  if (!entry || entry.deprecated) return null;

  return {
    escopoId: entry.escopoId,
    dominioId: entry.dominioId,
    assuntoId: entry.assuntoId,
    materiaId: entry.materiaId as CatalogMateriaId,
    areaEnem: asAreaEnem(entry.areaEnem, entry.materiaId as MateriaCorpusId),
    confianca,
  };
}

/** Resolve conceitoCanonic: prioriza campo do escopo, senão conceitos-canonicos.json. */
export function resolverConceitoCanonic(escopoId: string): string[] {
  const entry = indexGlobalEscopos().get(escopoId);
  if (entry?.conceitoCanonic) return [entry.conceitoCanonic];

  const mapa = mapaConceitoPorEscopo(carregarConceitosCanonicos());
  const id = mapa.get(escopoId);
  return id ? [id] : [];
}

export function catalogoVersaoDeEscopo(escopoId: string): string | null {
  const entry = indexGlobalEscopos().get(escopoId);
  if (!entry) return null;
  return `${entry.materiaId}@${entry.catalogVersion}`;
}
