import { numerosLogicosRevisaoImagem } from "@/lib/prova-revisao-imagem";

/** Rótulo genérico na UI — vale para figura, fórmula ou OCR incompleto em qualquer vestibular. */
export const LABEL_TEXTO_INCOMPLETO = "Texto incompleto";

export type PendenciasProvaAdmin = {
  faltando: number[];
  textoIncompleto: number[];
  cadastradas: number;
  totalQuestoes: number;
  coberturaPct: number;
  semQuestoes: boolean;
  bancoIncompleto: boolean;
  validacaoExtracaoPendente: boolean;
  gabaritoPendente: boolean;
  alertaAbaQuestoes: boolean;
  alertaAbaPedagogia: boolean;
};

type InputPendencias = {
  totalQuestoes: number;
  questoesCadastradas?: number;
  questoesFaltando?: number[];
  questoesRevisaoImagem?: number[];
  questoes: {
    numero: number;
    idiomaVariante?: string | null;
    alternativas?: string | null;
  }[];
  extracaoValidada?: boolean;
  gabaritoCompleto?: boolean;
  temTextoFonte?: boolean;
};

export function calcularPendenciasProva(input: InputPendencias): PendenciasProvaAdmin {
  const totalQuestoes = input.totalQuestoes;
  const faltando = input.questoesFaltando ?? [];
  const textoIncompleto =
    input.questoesRevisaoImagem ?? numerosLogicosRevisaoImagem(input.questoes);

  const cadastradas =
    input.questoesCadastradas ??
    new Set(
      input.questoes
        .filter((q) => q.idiomaVariante !== "ESPANHOL")
        .map((q) => q.numero)
    ).size;

  const semQuestoes = input.questoes.length === 0;
  const bancoIncompleto = faltando.length > 0;
  const coberturaPct =
    totalQuestoes > 0 ? Math.round((cadastradas / totalQuestoes) * 100) : 0;

  /** Só lembra validação quando houve extração (texto-fonte gravado), não em cadastro manual puro. */
  const validacaoExtracaoPendente =
    input.questoes.length > 0 &&
    !input.extracaoValidada &&
    Boolean(input.temTextoFonte);

  const gabaritoPendente = input.questoes.length > 0 && !input.gabaritoCompleto;

  const alertaAbaQuestoes =
    (semQuestoes && totalQuestoes > 0) || bancoIncompleto || textoIncompleto.length > 0;

  return {
    faltando,
    textoIncompleto,
    cadastradas,
    totalQuestoes,
    coberturaPct,
    semQuestoes,
    bancoIncompleto,
    validacaoExtracaoPendente,
    gabaritoPendente,
    alertaAbaQuestoes,
    alertaAbaPedagogia: gabaritoPendente,
  };
}

export function resumoPendenciasQuestoes(p: PendenciasProvaAdmin): string | null {
  const partes: string[] = [];
  if (p.semQuestoes && p.totalQuestoes > 0) partes.push("banco vazio");
  if (p.bancoIncompleto) partes.push(`${p.faltando.length} faltando`);
  if (p.textoIncompleto.length > 0) {
    partes.push(`${p.textoIncompleto.length} ${LABEL_TEXTO_INCOMPLETO.toLowerCase()}`);
  }
  if (p.validacaoExtracaoPendente) partes.push("validar extração");
  return partes.length ? partes.join(" · ") : null;
}
