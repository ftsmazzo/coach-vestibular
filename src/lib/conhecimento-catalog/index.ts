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
  arquivoCatalogoAtivo,
  carregarCatalogoMateria,
  carregarConceitosCanonicos,
  catalogoUsaClassificadorV11,
  idFallbackNaoClassificado,
  indexarEscopos,
  indexGlobalEscopos,
  labelMateriaCorpus,
  limparCacheCatalogos,
  limparCacheIndexGlobalEscopos,
  mapaConceitoPorEscopo,
  MATERIA_CORPUS_LABEL,
  MATERIAS_CORPUS,
  MATERIAS_CORPUS_NATUREZA,
  prefixoCatalogoMateria,
  PREFIXO_MATERIA,
} from "./load";
export type { EscopoIndexGlobalEntry, MateriaCorpusId } from "./load";

export { validarCatalogo, validarE0, validarE1, validarE2 } from "./validate";
export {
  montarBlocoQuestaoV11,
  montarCatalogoReduzido,
  montarSystemClassificacaoV11,
  montarSystemClassificacaoLinguagensV12,
} from "./prompt-classificacao";
