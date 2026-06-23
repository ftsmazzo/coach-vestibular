export type {
  AssuntoCatalogo,
  CatalogMeta,
  CatalogRegras,
  ClassificacaoStatus,
  ConceitoCanonico,
  ConceitosCanonicosFile,
  DominioCatalogo,
  EscopoCatalogo,
  EscopoIndexEntry,
  MateriaCatalogo,
  ResultadoClassificacao,
  ResultadoValidacao,
  ValidacaoNivel,
} from "./types";

export {
  carregarCatalogoMateria,
  carregarConceitosCanonicos,
  catalogoUsaClassificadorV11,
  idFallbackNaoClassificado,
  indexarEscopos,
  labelMateriaCorpus,
  mapaConceitoPorEscopo,
  MATERIA_CORPUS_LABEL,
  MATERIAS_CORPUS,
  MATERIAS_CORPUS_NATUREZA,
  prefixoCatalogoMateria,
  PREFIXO_MATERIA,
} from "./load";
export type { MateriaCorpusId } from "./load";

export { validarCatalogo, validarE0, validarE1, validarE2 } from "./validate";
export {
  montarBlocoQuestaoV11,
  montarCatalogoReduzido,
  montarSystemClassificacaoV11,
} from "./prompt-classificacao";
