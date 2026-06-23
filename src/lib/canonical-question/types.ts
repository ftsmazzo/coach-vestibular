import type { MateriaCorpusId } from "@/lib/enem-corpus-materia";

export const CANONICAL_SCHEMA_VERSION = "1.0.0";

/** materiaId do catálogo Coach (≠ materiaId grosso da taxonomy.json). */
export type CatalogMateriaId = MateriaCorpusId;

export type AreaEnem =
  | "Ciências da Natureza"
  | "Matemática"
  | "Linguagens, Códigos e suas Tecnologias"
  | "Ciências Humanas e suas Tecnologias";

/** Nó de classificação — escopoId (N2) é autoritativo; demais campos derivados do catálogo. */
export type ClassNode = {
  escopoId: string;
  dominioId: string;
  assuntoId: string;
  materiaId: CatalogMateriaId;
  areaEnem: AreaEnem;
  confianca: number;
};

export type HabilidadeCognitiva =
  | "identificar"
  | "interpretar"
  | "comparar"
  | "calcular"
  | "inferir";

export type MetodoClassificacao = "ia" | "humano" | "ia_revisado";

export type RevisaoHumana = {
  status: "pendente" | "aprovado" | "rejeitado";
  revisorId?: string;
  revisadoEm?: string;
  observacao?: string;
};

export type Classificacao = {
  primario: ClassNode;
  secundarios: ClassNode[];
  conceitoCanonic: string[];
  conhecimentoExigidoN3: string[];
  contexto?: string;
  habilidadeCognitiva?: HabilidadeCognitiva;
  dificuldadeEstimada?: "baixa" | "media" | "alta";
  metodo: MetodoClassificacao;
  confiancaGlobal: number;
  revisao: RevisaoHumana;
  classificadoEm: string;
  catalogoVersao: string;
  naoClassificado: boolean;
};

export type FonteTipo = "enem_api" | "caderno_upload" | "simulado" | "manual";

export type Proveniencia = {
  tipo: FonteTipo;
  sourceId?: string;
  banca?: string;
  ano?: number;
  caderno?: string;
  numeroOriginal?: number;
  uploadId?: string;
  importadoEm: string;
};

export type Alternativa = {
  letra: string;
  texto: string;
};

export type CanonicalQuestion = {
  questionId: string;
  schemaVersion: typeof CANONICAL_SCHEMA_VERSION;
  fonte: Proveniencia;
  enunciado?: string;
  textoApoio?: string;
  alternativas?: Alternativa[];
  gabarito?: string;
  classificacao: Classificacao;
};

export type TipoErro =
  | "CONCEITO_TEORICO"
  | "CALCULO_BOBEIRA"
  | "INTERPRETACAO_ENUNCIADO"
  | "DUVIDA_CRUCIAL"
  | "CHUTE_TOTAL"
  | "FALTA_TEMPO";

export type StudentAttempt = {
  attemptId: string;
  alunoId: string;
  questionId: string;
  respostaDada?: string;
  correto: boolean;
  tipoErro?: TipoErro;
  tempoGastoSeg?: number;
  origem: {
    simuladoId?: string;
    sessaoId?: string;
    data: string;
  };
};

export type NivelDiagnostico =
  | "escopo"
  | "dominio"
  | "assunto"
  | "materia"
  | "area"
  | "conceitoCanonic";

export type CelulaDiagnostico = {
  nivel: NivelDiagnostico;
  id: string;
  label: string;
  tentativas: number;
  erros: number;
  taxaErro: number;
  errosPorTipo: Partial<Record<TipoErro, number>>;
};

export type CriterioSelecaoQuests = {
  escopoId?: string;
  assuntoId?: string;
  conceitoCanonic?: string;
  dificuldade?: ("baixa" | "media" | "alta")[];
  excluirRespondidasPor?: string;
  apenasAprovadas?: boolean;
  limite?: number;
};

/** Campos de classificação N2 persistidos em ProvaQuestao / EnemQuestaoCorpus. */
export type CamposClassificacaoPersistidos = {
  conhecimentoEscopoId: string | null;
  conhecimentoDominioId: string | null;
  conhecimentoExigido: string | null;
  classificacaoVersao: string | null;
  classificacaoConfianca: number | null;
  classificacaoSecundariosJson: string | null;
  conceitosCanonicosJson: string | null;
};
