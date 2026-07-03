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

import {
  LABEL_DISCIPLINA_SPLIT,
  TODAS_DISCIPLINAS_SPLIT,
} from "./disciplinas-split";

const CATALOG_DIR = join(process.cwd(), "data", "conhecimento-catalog");

type CatalogManifest = {
  schemaVersion?: string;
  active?: Record<string, string>;
  roteamentoLinguagens?: string;
  roteamentoHumanas?: string;
  promptRoteamentoHumanas?: string;
  promptRoteamentoLinguagens?: string;
  promptRoteamentoAreaMacro?: string;
  prompts?: Record<string, string>;
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

/** Prefixos N2 das disciplinas humanas/linguagens desmembradas (Sprint 1). */
const PREFIXO_DISCIPLINA_SPLIT: Record<string, string> = {
  historia: "hist",
  geografia: "geo",
  filosofia: "fil",
  sociologia: "soc",
  portugues: "pt",
  ingles: "ing",
  espanhol: "esp",
};

/** Prefixo de IDs N2 por matéria (bio., quim., mat., …). */
export const PREFIXO_MATERIA: Record<string, string> = Object.fromEntries(
  Object.values(CORPUS_MATERIA_CONFIG).map((c) => [c.materiaId, c.prefixo])
);

export function prefixoCatalogoMateria(materiaId: string): string {
  return PREFIXO_MATERIA[materiaId] ?? PREFIXO_DISCIPLINA_SPLIT[materiaId] ?? materiaId;
}

/** Rótulo persistido em EnemQuestaoCorpus.materia. */
export const MATERIA_CORPUS_LABEL: Record<string, string> = Object.fromEntries(
  Object.values(CORPUS_MATERIA_CONFIG).map((c) => [c.materiaId, c.label])
);

export function labelMateriaCorpus(materiaId: string): string {
  if (materiaId in LABEL_DISCIPLINA_SPLIT) {
    return LABEL_DISCIPLINA_SPLIT[materiaId as keyof typeof LABEL_DISCIPLINA_SPLIT];
  }
  return MATERIA_CORPUS_LABEL[materiaId] ?? materiaId;
}

export function carregarPromptCatalogo(fileName: string): string {
  return readFileSync(join(CATALOG_DIR, fileName), "utf-8");
}

export function promptClassificacaoDisciplina(materiaId: string): string | null {
  const manifest = carregarManifest();
  const file = manifest.prompts?.[materiaId];
  if (!file) return null;
  return carregarPromptCatalogo(file);
}

export function promptRoteamentoHumanas(): string | null {
  const manifest = carregarManifest();
  const file = manifest.promptRoteamentoHumanas;
  const md = file ? carregarPromptCatalogo(file) : "";
  const spec = blocoSpecRoteamento(manifest.roteamentoHumanas);
  const merged = `${md}${spec}`.trim();
  return merged || null;
}

export function promptRoteamentoLinguagens(): string | null {
  const manifest = carregarManifest();
  const file = manifest.promptRoteamentoLinguagens;
  const md = file ? carregarPromptCatalogo(file) : "";
  const spec = blocoSpecRoteamento(manifest.roteamentoLinguagens);
  const merged = `${md}${spec}`.trim();
  return merged || null;
}

export function promptRoteamentoAreaMacro(): string | null {
  const manifest = carregarManifest();
  const file = manifest.promptRoteamentoAreaMacro;
  if (!file) return null;
  return carregarPromptCatalogo(file).trim() || null;
}

function blocoSpecRoteamento(fileName?: string): string {
  if (!fileName) return "";
  try {
    const spec = readJson<{
      disciplineRoutingRules?: unknown;
      globalRules?: unknown;
      tieBreakMatrix?: unknown;
    }>(fileName);
    const payload = {
      disciplineRoutingRules: spec.disciplineRoutingRules,
      globalRules: spec.globalRules,
      tieBreakMatrix: spec.tieBreakMatrix,
    };
    return `\n\n## Especificação de roteamento (obrigatória)\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``;
  } catch {
    return "";
  }
}

export function materiasCatalogoAtivas(): string[] {
  const manifest = carregarManifest();
  return Object.keys(manifest.active ?? {});
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

/** Índice N2 — corpus ENEM + disciplinas split (hist/geo/fil/soc/pt/ing/esp). */
export function indexGlobalEscopos(): Map<string, EscopoIndexGlobalEntry> {
  if (cacheIndexGlobal) return cacheIndexGlobal;

  const map = new Map<string, EscopoIndexGlobalEntry>();
  const agregadosLegado = new Set(["humanas", "linguagens"]);

  for (const materiaId of MATERIAS_CORPUS) {
    if (agregadosLegado.has(materiaId)) continue;
    indexarCatalogoNoMapa(map, materiaId);
  }

  for (const materiaId of TODAS_DISCIPLINAS_SPLIT) {
    indexarCatalogoNoMapa(map, materiaId);
  }

  cacheIndexGlobal = map;
  return map;
}

function indexarCatalogoNoMapa(
  map: Map<string, EscopoIndexGlobalEntry>,
  materiaId: string
): void {
  try {
    const catalog = carregarCatalogoMateria(materiaId);
    const local = indexarEscopos(catalog);
    for (const [escopoId, entry] of local) {
      map.set(escopoId, {
        ...entry,
        areaEnem: catalog.areaEnem,
        catalogVersion: catalog.catalogVersion ?? catalog.schemaVersion,
      });
    }
  } catch {
    /* catálogo opcional / manifest incompleto */
  }
}

/** Limpa cache do índice global (testes ou hot-reload de catálogo). */
export function limparCacheIndexGlobalEscopos(): void {
  cacheIndexGlobal = null;
}
