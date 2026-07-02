export interface ProvaQuestaoAdmin {
  id: string;
  numero: number;
  idiomaVariante?: string;
  areaBloco: string | null;
  materia: string;
  assunto: string;
  enunciado?: string | null;
  alternativas?: string | null;
  conhecimentoExigido: string | null;
  nivelDificuldade: string | null;
  observacoes: string | null;
  gabarito: string | null;
  conhecimentoEscopoId?: string | null;
  classificacaoN1Json?: string | null;
  classificacaoConfianca?: number | null;
  classificacaoVersao?: string | null;
}

export interface ProvaAdmin {
  id: string;
  nome: string;
  banca: string;
  tipo: string;
  ano: number | null;
  dia: number | null;
  caderno: string | null;
  descricao: string | null;
  publicada: boolean;
  gabaritoCompleto: boolean;
  extracaoValidada?: boolean;
  totalQuestoes: number;
  politicaIdiomas?: string;
  idiomaQuestaoInicio?: number | null;
  idiomaQuestaoFim?: number | null;
  ordemIdiomasFaixa?: "INGLES_PRIMEIRO" | "ESPANHOL_PRIMEIRO";
  questoesCadastradas?: number;
  questoesFaltando?: number[];
  questoesRevisaoImagem?: number[];
  bancoIncompleto?: boolean;
  questoes: ProvaQuestaoAdmin[];
  temTextoFonte?: boolean;
  tamanhoTextoFonte?: number | null;
  textoFonte?: string | null;
  cadernoFileName?: string | null;
  cadernoStoragePath?: string | null;
  tentativas?: {
    id: string;
    data: string;
    nota: number | null;
    user: { name: string; email: string };
  }[];
}

export type AbaProvaAdmin = "prova" | "questoes" | "pedagogia";

export interface ProvaMetaForm {
  banca: string;
  ano: string;
  dia: string;
  caderno: string;
  totalQuestoes: string;
  descricao: string;
  ordemIdiomasFaixa: "INGLES_PRIMEIRO" | "ESPANHOL_PRIMEIRO";
  politicaIdiomas: "NENHUMA" | "DUPLICATA_EN_ES";
  idiomaQuestaoInicio: string;
  idiomaQuestaoFim: string;
}
