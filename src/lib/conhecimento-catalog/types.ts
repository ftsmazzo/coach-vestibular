/** Contrato do catálogo fechado N1/N2 — schema v1.0.0 */

export type CatalogRegras = {
  idImutavel: boolean;
  iaSoEscolheIds: boolean;
  maxN2PorMateria: number;
  confiancaMinima: number;
};

export type CatalogMeta = {
  schemaVersion: string;
  catalogVersion: string;
  materiaId: string;
  materiaLabel: string;
  areaEnem?: string;
  notas?: string;
  regras: CatalogRegras;
};

export type EscopoCatalogo = {
  id: string;
  label: string;
  deprecated?: boolean;
  supersededBy?: string;
  conceitoCanonic?: string;
  keywords?: string[];
};

export type DominioCatalogo = {
  id: string;
  label: string;
  deprecated?: boolean;
  escopos: EscopoCatalogo[];
};

export type AssuntoCatalogo = {
  assuntoId: string;
  assuntoLabel: string;
  dominios: DominioCatalogo[];
};

export type MateriaCatalogo = CatalogMeta & {
  assuntos: AssuntoCatalogo[];
};

export type EscopoIndexEntry = {
  escopoId: string;
  escopoLabel: string;
  dominioId: string;
  dominioLabel: string;
  assuntoId: string;
  assuntoLabel: string;
  materiaId: string;
  keywords: string[];
  conceitoCanonic?: string;
  deprecated: boolean;
};

export type ConceitoCanonico = {
  id: string;
  label: string;
  escopos: string[];
  notas?: string;
};

export type ConceitosCanonicosFile = {
  schemaVersion: string;
  notas?: string;
  conceitos: ConceitoCanonico[];
};

export type ValidacaoNivel = "E0" | "E1" | "E2" | "E3";

export type ResultadoValidacao = {
  nivel: ValidacaoNivel;
  ok: boolean;
  mensagem: string;
};

export type ClassificacaoStatus = "classified" | "unclassified" | "review";

export type ResultadoClassificacao = {
  status: ClassificacaoStatus;
  confianca: number;
  materiaId: string | null;
  assuntoId: string | null;
  dominioId: string | null;
  escopoId: string | null;
  conceitoCanonic: string | null;
  motivo: string;
};
