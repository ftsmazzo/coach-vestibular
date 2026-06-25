import { labelTipoProva } from "@/lib/prova-tipo";
import type { ProvaTipo } from "@/generated/prisma/client";

/** Metadados da prova no cadastro — o PDF pode divergir; a IA deve inferir do documento. */
export interface ProvaPipelineContext {
  nome: string;
  banca: string;
  tipo: ProvaTipo;
  ano?: number | null;
  dia?: number | null;
  caderno?: string | null;
  descricao?: string | null;
  totalEsperado: number;
  /** Referência genérica — ajuda a validar contagem física (EN/ES duplicados). */
  politicaIdiomas?: string | null;
  idiomaQuestaoInicio?: number | null;
  idiomaQuestaoFim?: number | null;
}

export type FormatoLayoutProva =
  | "desconhecido"
  | "enem_por_area"
  | "vestibular_secoes"
  | "simulado_linear"
  | "multiplos_tipos"
  | "lista_fixacao";

export type IdiomasEstrangeirosDetectados =
  | "nenhum"
  | "duplicata_ingles_espanhol"
  | "somente_ingles"
  | "somente_espanhol"
  | "outro";

export type EstruturaProvaDetectada = {
  tipo_prova?: string;
  formato_layout?: FormatoLayoutProva;
  idiomas_estrangeiros?: IdiomasEstrangeirosDetectados;
  /** Ocorrências físicas no PDF (ordem de leitura), incluindo EN+ES duplicados */
  total_ocorrencias_detectado?: number;
  /** Números únicos que o aluno responde */
  total_questoes_logicas?: number;
  /** @deprecated alias de total_questoes_logicas */
  total_questoes_detectado?: number;
  /** Números únicos impressos */
  numeros_logicos?: number[];
  /** @deprecated use numeros_logicos */
  numeros?: number[];
  blocos?: Array<{
    titulo: string;
    /** Posição física no PDF (1ª questão do bloco = ordem_inicio). */
    ordem_inicio: number;
    ordem_fim: number;
    /** Número impresso no caderno. */
    questao_inicio: number;
    questao_fim: number;
  }>;
  observacoes?: string;
};

export function montarContextoProvaTxt(ctx: ProvaPipelineContext): string {
  const linhas = [
    `Prova: ${ctx.nome}`,
    `Banca/instituição: ${ctx.banca}`,
    `Categoria no sistema: ${labelTipoProva(ctx.tipo)}`,
    ctx.ano ? `Ano: ${ctx.ano}` : "",
    ctx.dia != null ? `Dia/etapa (se ENEM): ${ctx.dia}` : "",
    ctx.caderno ? `Caderno/tipo no cadastro: ${ctx.caderno}` : "",
    ctx.descricao?.trim() ? `Notas do admin: ${ctx.descricao.trim().slice(0, 400)}` : "",
    `Total de questões cadastrado (referência lógica, pode diferir do PDF): ${ctx.totalEsperado}`,
    ctx.politicaIdiomas === "DUPLICATA_EN_ES" &&
    ctx.idiomaQuestaoInicio != null &&
    ctx.idiomaQuestaoFim != null
      ? `Cadastro: faixa de idioma duplicada (inglês+espanhol) nos números ${ctx.idiomaQuestaoInicio}–${ctx.idiomaQuestaoFim} — espere ocorrências físicas a mais no PDF.`
      : "",
    "",
    "Instrução: adapte-se ao layout REAL do PDF (ENEM, vestibular estadual, simulado de cursinho, lista, etc.).",
    "Não assuma formato de uma banca específica — leia cabeçalhos, blocos e numeração como aparecem.",
  ];
  return linhas.filter(Boolean).join("\n");
}

export function resumoEstruturaParaClassificacao(estrutura: EstruturaProvaDetectada): string {
  const partes: string[] = [];
  if (estrutura.formato_layout && estrutura.formato_layout !== "desconhecido") {
    partes.push(`Formato detectado: ${estrutura.formato_layout}`);
  }
  if (estrutura.tipo_prova?.trim()) {
    partes.push(`Tipo/caderno no PDF: ${estrutura.tipo_prova.trim()}`);
  }
  if (estrutura.blocos?.length) {
    const bl = estrutura.blocos
      .slice(0, 12)
      .map(
        (b) =>
          `«${b.titulo}» ordem ${b.ordem_inicio}–${b.ordem_fim} · Q${b.questao_inicio}–${b.questao_fim}`
      )
      .join("; ");
    partes.push(`Blocos/seções: ${bl}`);
  }
  if (estrutura.idiomas_estrangeiros && estrutura.idiomas_estrangeiros !== "nenhum") {
    partes.push(`Idiomas no PDF: ${estrutura.idiomas_estrangeiros}`);
  }
  if (estrutura.observacoes?.trim()) {
    partes.push(`Observações da leitura: ${estrutura.observacoes.trim().slice(0, 280)}`);
  }
  return partes.join("\n");
}

/** Preferir duplicata EN/ES completa quando o PDF indica; «somente inglês» é opt-in legado. */
export function resolverPoliticaIdiomas(
  estrutura: EstruturaProvaDetectada,
  opts?: { forcarSomenteIngles?: boolean; incluirBlocoEspanhol?: boolean; forcarExcluirEspanhol?: boolean }
): { modoDuplicata: boolean; forcarSomenteIngles: boolean; automatico: boolean } {
  const dup = estrutura.idiomas_estrangeiros === "duplicata_ingles_espanhol";
  if (opts?.forcarSomenteIngles === true || opts?.forcarExcluirEspanhol === true) {
    return { modoDuplicata: false, forcarSomenteIngles: true, automatico: false };
  }
  if (opts?.incluirBlocoEspanhol === true && dup) {
    return { modoDuplicata: true, forcarSomenteIngles: false, automatico: false };
  }
  return { modoDuplicata: dup, forcarSomenteIngles: false, automatico: dup };
}

/** Mínimo de questões para aceitar estrutura — escala com tamanho da prova. */
export function minimoQuestoesEstrutura(totalEsperado: number): number {
  const ratio = parseFloat(process.env.PIPELINE_V2_MIN_COVERAGE ?? "0.55");
  const r = Number.isFinite(ratio) && ratio > 0 && ratio <= 1 ? ratio : 0.55;
  const ref = Math.max(1, Math.min(totalEsperado, 300));
  if (ref <= 15) return Math.max(3, Math.ceil(ref * r));
  if (ref <= 40) return Math.max(6, Math.ceil(ref * r));
  if (ref <= 90) return Math.max(12, Math.ceil(ref * r));
  return Math.max(20, Math.ceil(ref * r));
}
