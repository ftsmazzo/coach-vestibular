import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  ConceitosCanonicosFile,
  EscopoIndexEntry,
  MateriaCatalogo,
} from "./types";

const CATALOG_DIR = join(process.cwd(), "data", "conhecimento-catalog");

function readJson<T>(fileName: string): T {
  const raw = readFileSync(join(CATALOG_DIR, fileName), "utf-8");
  return JSON.parse(raw) as T;
}

export function carregarCatalogoMateria(materiaId: string): MateriaCatalogo {
  const file = materiaId === "biologia" ? "biologia.json" : `${materiaId}.json`;
  const catalog = readJson<MateriaCatalogo>(file);
  if (catalog.materiaId !== materiaId) {
    throw new Error(`Catálogo ${file}: materiaId "${catalog.materiaId}" ≠ "${materiaId}"`);
  }
  return catalog;
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
          conceitoCanonic: escopo.conceitoCanonic,
          deprecated: false,
        });
      }
    }
  }

  return map;
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
