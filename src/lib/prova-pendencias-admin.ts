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

export type FiltroListaProvas =
  | "todas"
  | "pendencias"
  | "banco_incompleto"
  | "texto_incompleto"
  | "gabarito_pendente"
  | "rascunho";

export type ProvaResumoLista = {
  nome: string;
  banca: string;
  publicada: boolean;
  gabaritoCompleto: boolean;
  bancoIncompleto: boolean;
  questoesCadastradas: number;
  totalQuestoes: number;
  questoesRevisaoImagem?: number[];
};

export function provaTemPendencias(p: ProvaResumoLista): boolean {
  return (
    p.bancoIncompleto ||
    (p.questoesRevisaoImagem?.length ?? 0) > 0 ||
    (p.questoesCadastradas > 0 && !p.gabaritoCompleto) ||
    (p.totalQuestoes > 0 && p.questoesCadastradas === 0)
  );
}

export function provaPassaFiltroLista(
  p: ProvaResumoLista,
  filtro: FiltroListaProvas,
  busca: string
): boolean {
  const termo = busca.trim().toLowerCase();
  if (termo) {
    const hay = `${p.nome} ${p.banca}`.toLowerCase();
    if (!hay.includes(termo)) return false;
  }
  switch (filtro) {
    case "todas":
      return true;
    case "pendencias":
      return provaTemPendencias(p);
    case "banco_incompleto":
      return p.bancoIncompleto || (p.totalQuestoes > 0 && p.questoesCadastradas === 0);
    case "texto_incompleto":
      return (p.questoesRevisaoImagem?.length ?? 0) > 0;
    case "gabarito_pendente":
      return p.questoesCadastradas > 0 && !p.gabaritoCompleto;
    case "rascunho":
      return !p.publicada;
    default:
      return true;
  }
}

export type AbaProvaUrl = "prova" | "questoes" | "pedagogia";

export function hrefAdminProva(
  id: string,
  opts?: { aba?: AbaProvaUrl; q?: number; filtro?: string }
): string {
  const params = new URLSearchParams();
  if (opts?.aba) params.set("aba", opts.aba);
  if (opts?.q != null && opts.q >= 1) params.set("q", String(opts.q));
  if (opts?.filtro) params.set("filtro", opts.filtro);
  const qs = params.toString();
  return `/admin/provas/${id}${qs ? `?${qs}` : ""}`;
}

export function parseAbaProvaUrl(raw: string | null): AbaProvaUrl | null {
  if (raw === "prova" || raw === "questoes" || raw === "pedagogia") return raw;
  return null;
}

export type FiltroTabelaPedagogia =
  | "revisao_imagem"
  | "sem_n1"
  | "sem_n2"
  | "alerta";

export function parseFiltroTabelaPedagogia(raw: string | null): FiltroTabelaPedagogia | null {
  if (
    raw === "revisao_imagem" ||
    raw === "sem_n1" ||
    raw === "sem_n2" ||
    raw === "alerta"
  ) {
    return raw;
  }
  return null;
}
