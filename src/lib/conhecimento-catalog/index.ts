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
  indexarEscopos,
  mapaConceitoPorEscopo,
} from "./load";

export { validarCatalogo, validarE0, validarE1, validarE2 } from "./validate";
