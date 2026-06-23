import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  ConceitosCanonicosFile,
  EscopoIndexEntry,
  MateriaCatalogo,
} from "./types";
import {
  CORPUS_MATERIA_CONFIG,
  MATERIAS_CORPUS,
  type MateriaCorpusId,
} from "@/lib/enem-corpus-materia";

const CATALOG_DIR = join(process.cwd(), "data", "conhecimento-catalog");

type CatalogManifest = {
  schemaVersion?: string;
  active?: Record<string, string>;
};

let cacheManifest: CatalogManifest | null = null;

function carregarManifest(): CatalogManifest {
  if (cacheManifest) return cacheManifest;
  try {
    cacheManifest = readJson<CatalogManifest>("catalog-manifest.json");
  } catch {
    cacheManifest = { active: {} };
  }
  return cacheManifest;
}

function resolverArquivoCatalogo(materiaId: string): string {
  const manifest = carregarManifest();
  const fromManifest = manifest.active?.[materiaId];
  if (fromManifest) return fromManifest;
  if (materiaId === "biologia") return "biologia.json";
  return `${materiaId}.json`;
}

/** Limpa cache de manifest e índice global (testes ou promoção de catálogo). */
export function limparCacheCatalogos(): void {
  cacheManifest = null;
  limparCacheIndexGlobalEscopos();
}

/** Prefixo de IDs N2 por matéria (bio., quim., mat., …). */
export const PREFIXO_MATERIA: Record<string, string> = Object.fromEntries(
  Object.values(CORPUS_MATERIA_CONFIG).map((c) => [c.materiaId, c.prefixo])
);

export function prefixoCatalogoMateria(materiaId: string): string {
  return PREFIXO_MATERIA[materiaId] ?? materiaId;
}

/** Rótulo persistido em EnemQuestaoCorpus.materia. */
export const MATERIA_CORPUS_LABEL: Record<string, string> = Object.fromEntries(
  Object.values(CORPUS_MATERIA_CONFIG).map((c) => [c.materiaId, c.label])
);

export function labelMateriaCorpus(materiaId: string): string {
  return MATERIA_CORPUS_LABEL[materiaId] ?? materiaId;
}

export { MATERIAS_CORPUS, type MateriaCorpusId };

/** @deprecated use MATERIAS_CORPUS */
export const MATERIAS_CORPUS_NATUREZA = ["biologia", "quimica", "fisica"] as const;

function readJson<T>(fileName: string): T {
  const raw = readFileSync(join(CATALOG_DIR, fileName), "utf-8");
  return JSON.parse(raw) as T;
}

export function carregarCatalogoMateria(materiaId: string): MateriaCatalogo {
  const file = resolverArquivoCatalogo(materiaId);
  const catalog = readJson<MateriaCatalogo>(file);
  if (catalog.materiaId !== materiaId) {
    throw new Error(`Catálogo ${file}: materiaId "${catalog.materiaId}" ≠ "${materiaId}"`);
  }
  return catalog;
}

export function arquivoCatalogoAtivo(materiaId: string): string {
  return resolverArquivoCatalogo(materiaId);
}

export function carregarConceitosCanonicos(): ConceitosCanonicosFile {
  return readJson<ConceitosCanonicosFile>("conceitos-canonicos.json");
}

/** Índice plano de escopos N2 ativos — base para classificador e validação E0. */
export function indexarEscopos(catalog: MateriaCatalogo): Map<string, EscopoIndexEntry> {
  const map = new Map<string, EscopoIndexEntry>();

  for (const assunto of catalog.assuntos) {
    for (const dominio of assunto.dominios) {
      if (dominio.deprecated) continue;
      for (const escopo of dominio.escopos) {
        if (escopo.deprecated) continue;
        map.set(escopo.id, {
          escopoId: escopo.id,
          escopoLabel: escopo.label,
          dominioId: dominio.id,
          dominioLabel: dominio.label,
          assuntoId: assunto.assuntoId,
          assuntoLabel: assunto.assuntoLabel,
          materiaId: catalog.materiaId,
          keywords: escopo.keywords ?? [],
          keywordsContexto: escopo.keywordsContexto ?? [],
          negativeHints: escopo.negativeHints ?? [],
          descricao: escopo.descricao,
          exemplosEnunciado: escopo.exemplosEnunciado ?? [],
          naoConfundirCom: escopo.naoConfundirCom ?? [],
          regraDesempate: escopo.regraDesempate,
          conceitoCanonic: escopo.conceitoCanonic,
          deprecated: false,
          ehFallback: escopo.id.endsWith(".__nao_classificado"),
        });
      }
    }
  }

  return map;
}

/** Catálogo v1.1+ (campos ricos) ou v1.2+ (negativeHints, regras completas). */
export function catalogoUsaClassificadorV11(catalog: MateriaCatalogo): boolean {
  const v = catalog.schemaVersion ?? catalog.catalogVersion ?? "1.0.0";
  const [major, minor] = v.split(".").map(Number);
  return major > 1 || (major === 1 && (minor ?? 0) >= 1);
}

export function idFallbackNaoClassificado(materiaId: string): string {
  const prefixo = prefixoCatalogoMateria(materiaId);
  return `${prefixo}.__nao_classificado`;
}

export function mapaConceitoPorEscopo(
  conceitos: ConceitosCanonicosFile
): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of conceitos.conceitos) {
    for (const escopoId of c.escopos) {
      map.set(escopoId, c.id);
    }
  }
  return map;
}

export type EscopoIndexGlobalEntry = EscopoIndexEntry & {
  areaEnem?: string;
  catalogVersion: string;
};

let cacheIndexGlobal: Map<string, EscopoIndexGlobalEntry> | null = null;

/** Índice N2 de todas as matérias do corpus — base para derivarClassNode. */
export function indexGlobalEscopos(): Map<string, EscopoIndexGlobalEntry> {
  if (cacheIndexGlobal) return cacheIndexGlobal;

  const map = new Map<string, EscopoIndexGlobalEntry>();
  for (const materiaId of MATERIAS_CORPUS) {
    const catalog = carregarCatalogoMateria(materiaId);
    const local = indexarEscopos(catalog);
    for (const [escopoId, entry] of local) {
      map.set(escopoId, {
        ...entry,
        areaEnem: catalog.areaEnem,
        catalogVersion: catalog.catalogVersion,
      });
    }
  }

  cacheIndexGlobal = map;
  return map;
}

/** Limpa cache do índice global (testes ou hot-reload de catálogo). */
export function limparCacheIndexGlobalEscopos(): void {
  cacheIndexGlobal = null;
}
