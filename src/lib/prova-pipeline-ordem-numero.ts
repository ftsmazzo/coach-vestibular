import type { EstruturaProvaDetectada } from "@/lib/prova-pipeline-contexto";
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
