import type { EstruturaProvaDetectada } from "@/lib/prova-pipeline-contexto";
import type { ProvaPipelineContext } from "@/lib/prova-pipeline-contexto";
import { sanitizarTextoProva } from "@/lib/prova-texto-prova";

export type BlocoOrdemNumero = {
  titulo: string;
  ordem_inicio: number;
  ordem_fim: number;
  questao_inicio: number;
  questao_fim: number;
};

/** Soma das ordens físicas declaradas nos blocos. */
export function somaOrdensBlocos(blocos: BlocoOrdemNumero[] | undefined): number {
  if (!blocos?.length) return 0;
  return blocos.reduce((s, b) => s + (b.ordem_fim - b.ordem_inicio + 1), 0);
}

/**
 * Mapa ordem física → número impresso, derivado só da estrutura (camada separada da extração de texto).
 */
export function montarMapaOrdemNumero(
  estrutura: EstruturaProvaDetectada,
  totalOcorrencias: number
): Map<number, number> {
  const map = new Map<number, number>();
  const blocos = (estrutura.blocos ?? []) as BlocoOrdemNumero[];

  for (const b of blocos) {
    const oi = b.ordem_inicio;
    const of = b.ordem_fim;
    const qi = b.questao_inicio;
    const qf = b.questao_fim;
    if (!oi || !of || !qi || !qf || of < oi || qf < qi) continue;
    const nOrd = of - oi + 1;
    const nNum = qf - qi + 1;
    if (nOrd !== nNum) continue;
    for (let i = 0; i < nOrd; i++) {
      map.set(oi + i, qi + i);
    }
  }

  if (map.size >= totalOcorrencias) return map;

  const nums = [...new Set(estrutura.numeros_logicos ?? [])]
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  if (nums.length > 0 && totalOcorrencias === nums.length) {
    for (let o = 1; o <= totalOcorrencias; o++) {
      if (!map.has(o)) map.set(o, nums[o - 1]!);
    }
  }

  return map;
}

export function instrucaoMapaOrdemLote(
  mapa: Map<number, number>,
  ordens: number[]
): string {
  const linhas = ordens.map((o) => {
    const n = mapa.get(o);
    return n != null ? `- ordem ${o} → número impresso ${n}` : `- ordem ${o}`;
  });
  return `Mapa deste lote (use ordem para localizar; número impresso já está definido):\n${linhas.join("\n")}`;
}

/** Assinatura curta do enunciado para detectar cópias indevidas entre ordens. */
export function assinaturaEnunciado(texto: string | undefined | null): string {
  const t = sanitizarTextoProva(texto ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  if (t.length < 60) return "";
  return t.slice(0, 220);
}

export function detectarEnunciadosDuplicados(
  rows: Array<{ ordemExtracao?: number | null; enunciado?: string | null }>
): Array<{ ordemA: number; ordemB: number }> {
  const vistos = new Map<string, number>();
  const pares: Array<{ ordemA: number; ordemB: number }> = [];
  for (const r of rows) {
    const ordem = r.ordemExtracao;
    if (ordem == null) continue;
    const sig = assinaturaEnunciado(r.enunciado);
    if (!sig) continue;
    const prev = vistos.get(sig);
    if (prev != null && prev !== ordem) {
      pares.push({ ordemA: prev, ordemB: ordem });
    } else {
      vistos.set(sig, ordem);
    }
  }
  return pares;
}

/** Resolve total físico: prioriza soma dos blocos quando coerente. */
export function resolverTotalOcorrencias(estrutura: EstruturaProvaDetectada): number {
  const declarado = estrutura.total_ocorrencias_detectado ?? 0;
  const somaBlocos = somaOrdensBlocos(estrutura.blocos as BlocoOrdemNumero[] | undefined);
  if (somaBlocos > 0 && somaBlocos >= declarado) return somaBlocos;
  return Math.max(1, declarado);
}

/** Mínimo de ocorrências físicas quando cadastro indica faixa EN/ES duplicada. */
export function ocorrenciasMinimasCadastro(ctx: {
  totalEsperado: number;
  politicaIdiomas?: string | null;
  idiomaQuestaoInicio?: number | null;
  idiomaQuestaoFim?: number | null;
}): number | null {
  if (ctx.politicaIdiomas !== "DUPLICATA_EN_ES") return null;
  const ini = ctx.idiomaQuestaoInicio;
  const fim = ctx.idiomaQuestaoFim;
  if (ini == null || fim == null || fim < ini) return null;
  return ctx.totalEsperado + (fim - ini + 1);
}

function normTituloBloco(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function blocoTituloEhIngles(titulo: string): boolean {
  const t = normTituloBloco(titulo);
  return (/ingles|lingua inglesa|english/.test(t) || /ingles e suas/.test(t)) && !/espanhol/.test(t);
}

export function blocoTituloEhEspanhol(titulo: string): boolean {
  const t = normTituloBloco(titulo);
  return /espanhol|lingua espanhola|spanish/.test(t) && !/ingles|english/.test(t);
}

/**
 * Blocos físicos esperados a partir do cadastro (genérico — qualquer prova com DUPLICATA EN/ES).
 */
export function montarBlocosFisicosCadastro(ctx: {
  totalEsperado: number;
  politicaIdiomas?: string | null;
  idiomaQuestaoInicio?: number | null;
  idiomaQuestaoFim?: number | null;
  ordemIdiomasFaixa?: string | null;
}): BlocoOrdemNumero[] | null {
  if (ctx.politicaIdiomas !== "DUPLICATA_EN_ES") return null;
  const ini = ctx.idiomaQuestaoInicio;
  const fim = ctx.idiomaQuestaoFim;
  if (ini == null || fim == null || fim < ini || ctx.totalEsperado < 1) return null;

  const faixaSize = fim - ini + 1;
  const ptFim = ctx.totalEsperado - faixaSize;
  if (ptFim < 0) return null;

  const esPrimeiro = ctx.ordemIdiomasFaixa === "ESPANHOL_PRIMEIRO";
  const blocos: BlocoOrdemNumero[] = [];

  if (ptFim > 0) {
    blocos.push({
      titulo: "Português",
      ordem_inicio: 1,
      ordem_fim: ptFim,
      questao_inicio: 1,
      questao_fim: ptFim,
    });
  }

  const ordemIdioma1Ini = ptFim + 1;
  const ordemIdioma1Fim = ptFim + faixaSize;
  const ordemIdioma2Ini = ordemIdioma1Fim + 1;
  const ordemIdioma2Fim = ordemIdioma1Fim + faixaSize;

  const blocoEs: BlocoOrdemNumero = {
    titulo: "Espanhol",
    ordem_inicio: esPrimeiro ? ordemIdioma1Ini : ordemIdioma2Ini,
    ordem_fim: esPrimeiro ? ordemIdioma1Fim : ordemIdioma2Fim,
    questao_inicio: ini,
    questao_fim: fim,
  };
  const blocoEn: BlocoOrdemNumero = {
    titulo: "Inglês",
    ordem_inicio: esPrimeiro ? ordemIdioma2Ini : ordemIdioma1Ini,
    ordem_fim: esPrimeiro ? ordemIdioma2Fim : ordemIdioma1Fim,
    questao_inicio: ini,
    questao_fim: fim,
  };

  blocos.push(esPrimeiro ? blocoEs : blocoEn, esPrimeiro ? blocoEn : blocoEs);
  return blocos;
}

/** Se a IA detectou duplicata mas só um bloco estrangeiro, acrescenta o bloco faltante (EN ou ES). */
export function completarBlocosIdiomaFaltante(
  estrutura: EstruturaProvaDetectada
): EstruturaProvaDetectada {
  if (estrutura.idiomas_estrangeiros !== "duplicata_ingles_espanhol") return estrutura;

  const blocos = [...((estrutura.blocos ?? []) as BlocoOrdemNumero[])];
  const temEn = blocos.some((b) => blocoTituloEhIngles(b.titulo));
  const temEs = blocos.some((b) => blocoTituloEhEspanhol(b.titulo));
  if (temEn && temEs) return estrutura;

  const referencia = blocos.find(
    (b) => blocoTituloEhIngles(b.titulo) || blocoTituloEhEspanhol(b.titulo)
  );
  if (!referencia?.ordem_inicio || !referencia.ordem_fim) return estrutura;

  const maxOrdem = blocos.reduce((m, b) => Math.max(m, b.ordem_fim ?? 0), 0);
  const nOrd = referencia.ordem_fim - referencia.ordem_inicio + 1;
  const faltante: BlocoOrdemNumero = {
    titulo: temEs ? "Inglês" : "Espanhol",
    ordem_inicio: maxOrdem + 1,
    ordem_fim: maxOrdem + nOrd,
    questao_inicio: referencia.questao_inicio,
    questao_fim: referencia.questao_fim,
  };

  const merged = [...blocos, faltante];
  const total = somaOrdensBlocos(merged);
  return {
    ...estrutura,
    blocos: merged,
    total_ocorrencias_detectado: total,
  };
}

/** Normaliza estrutura: cadastro prevalece; senão completa bloco EN/ES faltante. */
export function normalizarEstruturaProva(
  estrutura: EstruturaProvaDetectada,
  ctx?: Pick<
    ProvaPipelineContext,
    | "totalEsperado"
    | "politicaIdiomas"
    | "idiomaQuestaoInicio"
    | "idiomaQuestaoFim"
    | "ordemIdiomasFaixa"
  >
): EstruturaProvaDetectada {
  const cadastro = ctx
    ? montarBlocosFisicosCadastro({
        totalEsperado: ctx.totalEsperado,
        politicaIdiomas: ctx.politicaIdiomas,
        idiomaQuestaoInicio: ctx.idiomaQuestaoInicio,
        idiomaQuestaoFim: ctx.idiomaQuestaoFim,
        ordemIdiomasFaixa: ctx.ordemIdiomasFaixa,
      })
    : null;

  if (cadastro) {
    const total = somaOrdensBlocos(cadastro);
    const logicas = ctx!.totalEsperado;
    return {
      ...estrutura,
      blocos: cadastro,
      total_ocorrencias_detectado: total,
      total_questoes_logicas: logicas,
      numeros_logicos: Array.from({ length: logicas }, (_, i) => i + 1),
      idiomas_estrangeiros: "duplicata_ingles_espanhol",
    };
  }

  return completarBlocosIdiomaFaltante(estrutura);
}

/** Falha se alguma ordem física esperada não foi extraída. */
export function exigirCoberturaOrdens(
  rows: Array<{ ordemExtracao?: number | null }>,
  totalOcorrencias: number
): void {
  const presentes = new Set(rows.map((r) => r.ordemExtracao).filter((o) => o != null && o > 0));
  const faltando: number[] = [];
  for (let o = 1; o <= totalOcorrencias; o++) {
    if (!presentes.has(o)) faltando.push(o);
  }
  if (faltando.length === 0) return;
  const amostra = faltando.slice(0, 12).join(", ");
  throw new Error(
    `Extração incompleta: faltam ${faltando.length} ordem(ns) física(s) (${amostra}${faltando.length > 12 ? "…" : ""}).`
  );
}
