import {
  carregarCatalogoMateria,
  idFallbackNaoClassificado,
  indexarEscopos,
  labelMateriaCorpus,
} from "@/lib/conhecimento-catalog/load";
import { montarCatalogoReduzido } from "@/lib/conhecimento-catalog/prompt-classificacao";
import { LABEL_DISCIPLINA_SPLIT, ehCatalogDisciplinaSplit, prefixoValidoParaDisciplina } from "@/lib/conhecimento-catalog/disciplinas-split";
import type { EscopoIndexEntry } from "@/lib/conhecimento-catalog/types";
import { catalogoN1Valido } from "@/lib/catalogos-n1-destino";
import { CORPUS_MATERIA_CONFIG, type MateriaCorpusId } from "@/lib/enem-corpus-materia";

export type EscopoN2Opcao = {
  id: string;
  label: string;
  assuntoId: string;
  assuntoLabel: string;
  dominioId: string;
  ehFallback?: boolean;
};

export function listarEscoposCatalogoN1(catalogoId: string): EscopoN2Opcao[] {
  if (!catalogoN1Valido(catalogoId)) return [];
  const catalog = carregarCatalogoMateria(catalogoId);
  const reduzido = montarCatalogoReduzido(indexarEscopos(catalog));
  const assuntos = new Map(catalog.assuntos.map((a) => [a.assuntoId, a.assuntoLabel]));
  const dominios = new Map<string, string>();
  for (const a of catalog.assuntos) {
    for (const d of a.dominios) dominios.set(d.id, d.label);
  }
  const escopos = indexarEscopos(catalog);
  const out: EscopoN2Opcao[] = reduzido.map((e) => {
    const full = escopos.get(e.id)!;
    return {
      id: e.id,
      label: e.label,
      assuntoId: e.assuntoId,
      assuntoLabel: assuntos.get(e.assuntoId) ?? e.assuntoId,
      dominioId: full.dominioId,
    };
  });
  const fb = idFallbackNaoClassificado(catalogoId);
  if (escopos.has(fb)) {
    const full = escopos.get(fb)!;
    out.push({
      id: fb,
      label: full.escopoLabel,
      assuntoId: full.assuntoId,
      assuntoLabel: assuntos.get(full.assuntoId) ?? full.assuntoId,
      dominioId: full.dominioId,
      ehFallback: true,
    });
  }
  return out;
}

export function validarEscopoNoCatalogoN1(catalogoId: string, escopoId: string): EscopoIndexEntry | null {
  if (!catalogoN1Valido(catalogoId)) return null;
  const entry = indexarEscopos(carregarCatalogoMateria(catalogoId)).get(escopoId);
  if (!entry) return null;
  if (ehCatalogDisciplinaSplit(catalogoId) && !prefixoValidoParaDisciplina(escopoId, catalogoId)) {
    return null;
  }
  return entry;
}

export function labelsManualEscopoN2(catalogoId: string, entry: EscopoIndexEntry): {
  materia: string;
  assunto: string;
} {
  if (ehCatalogDisciplinaSplit(catalogoId)) {
    return {
      materia: LABEL_DISCIPLINA_SPLIT[catalogoId],
      assunto: entry.escopoLabel,
    };
  }
  const cfg = CORPUS_MATERIA_CONFIG[catalogoId as MateriaCorpusId];
  return {
    materia: cfg?.label ?? labelMateriaCorpus(catalogoId) ?? catalogoId,
    assunto: entry.escopoLabel,
  };
}

export function camposManualEscopoN2(catalogoId: string, escopoId: string) {
  const entry = validarEscopoNoCatalogoN1(catalogoId, escopoId);
  if (!entry) return null;
  const { materia, assunto } = labelsManualEscopoN2(catalogoId, entry);
  return {
    conhecimentoEscopoId: escopoId,
    conhecimentoDominioId: entry.dominioId,
    materia,
    assunto,
    classificacaoConfianca: 1,
    classificacaoVersao: `n2-manual|cat=${catalogoId}|esc=${escopoId}`,
    classificacaoSecundariosJson: null,
    conceitosCanonicosJson: entry.conceitoCanonic
      ? JSON.stringify([entry.conceitoCanonic])
      : null,
    conhecimentoExigido: null,
  };
}
