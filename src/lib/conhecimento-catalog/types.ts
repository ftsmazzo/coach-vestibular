/** Contrato do catálogo fechado N1/N2 — schema v1.0+ (v1.1: campos ricos para IA) */

export type CatalogMultiLabel = {
  permitido: boolean;
  maxPrimarios: number;
  maxSecundarios: number;
  nota?: string;
};

export type CatalogRegras = {
  idImutavel: boolean;
  iaSoEscolheIds: boolean;
  maxN2PorMateria: number;
  confiancaMinima: number;
  iaSoEscolheIdsNota?: string;
  confiancaMinimaNota?: string;
  fallbackNaoContaNoMax?: boolean;
  multiLabel?: CatalogMultiLabel;
  politicaN3?: string;
  regraDesempate?: string;
  conceitoCanonicNota?: string;
  pesos?: {
    keywords?: number;
    keywordsContexto?: number;
    exemplosEnunciado?: string;
    negativeHints?: string;
  };
  /** Linguagens v1.2+ — roteamento obrigatório antes da classificação N2. */
  roteamentoObrigatorio?: {
    etapa1?: string;
    etapa2?: string;
    regraCritica?: string;
    ordemDePreferencia?: string[];
    rotas: Record<string, string[]>;
  };
};

export type CatalogMeta = {
  schemaVersion: string;
  catalogVersion: string;
  materiaId: string;
  materiaLabel: string;
  areaEnem?: string;
  notas?: string;
  changelog?: string[];
  regras: CatalogRegras;
};

export type EscopoCatalogo = {
  id: string;
  label: string;
  deprecated?: boolean;
  supersededBy?: string;
  conceitoCanonic?: string;
  descricao?: string;
  keywords?: string[];
  keywordsContexto?: string[];
  /** Termos que penalizam este escopo se aparecerem no enunciado (v1.2+). */
  negativeHints?: string[];
  exemplosEnunciado?: string[];
  naoConfundirCom?: string[];
  regraDesempate?: string;
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
  keywordsContexto: string[];
  negativeHints: string[];
  descricao?: string;
  exemplosEnunciado: string[];
  naoConfundirCom: string[];
  regraDesempate?: string;
  conceitoCanonic?: string;
  deprecated: boolean;
  ehFallback: boolean;
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
  /** Linguagens — disciplina fina após roteamento (portugues|ingles|espanhol). */
  disciplinaOriginalId?: string | null;
  /** Critério do roteamento de idioma (auditoria). */
  rotaCriterio?: string | null;
  motivo: string;
  /** N3 — texto livre proposto pela IA (revisão humana) */
  conhecimentoExigido?: string | null;
  escoposSecundarios?: Array<{ escopoId: string; confianca: number }>;
  sinalizadorRevisao?: boolean;
  justificativa?: string | null;
};
