import type { IdiomaVarianteQuestao, PoliticaIdiomasProva } from "@/generated/prisma/client";
import type { EstruturaProvaDetectada } from "@/lib/prova-pipeline-contexto";
import { heuristicaLinguagensDisciplina } from "@/lib/enem-classificar/heuristica-roteamento-disciplina";
import {
  detectarPassagemEspanhol,
  detectarPassagemIngles,
  textoIndicaPortuguesInterpretacao,
} from "@/lib/prova-materia-ajuste";
import type { ProvaQuestaoRow } from "@/lib/parse-prova-csv";

export type FaixaIdiomaOpcional = { inicio: number; fim: number };

export type InferirFaixaIdiomaOpts = {
  banca?: string;
  totalEsperado?: number;
  /** Faixa já cadastrada na prova — prioridade sobre inferência do PDF. */
  faixaCadastro?: FaixaIdiomaOpcional | null;
};

function normTituloBloco(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function blocoEhPortugues(titulo: string): boolean {
  const t = normTituloBloco(titulo);
  if (/ingles|espanhol|estrangeir/.test(t)) return false;
  return (
    /portugues|lingua portuguesa/.test(t) ||
    (/^linguagens\b/.test(t) && /codigos|portug/.test(t))
  );
}

function blocoEhIngles(titulo: string): boolean {
  const t = normTituloBloco(titulo);
  return (/ingles|lingua inglesa/.test(t) || /ingles e suas/.test(t)) && !/espanhol/.test(t);
}

function blocoEhEspanhol(titulo: string): boolean {
  const t = normTituloBloco(titulo);
  return /espanhol|lingua espanhola/.test(t) && !/ingles/.test(t);
}

/** Heurística por banca quando blocos do PDF estão incompletos ou errados. */
export function faixaIdiomaHeuristicaBanca(
  banca?: string,
  totalEsperado?: number,
  numeros?: number[]
): FaixaIdiomaOpcional | null {
  const b = normTituloBloco(banca ?? "");
  const maxNum = numeros?.length ? Math.max(...numeros.filter((n) => n > 0)) : 0;
  const total = totalEsperado && totalEsperado > 0 ? totalEsperado : maxNum;
  const isUfu = /\bufu\b|uberlandia/.test(b);

  if (isUfu && total >= 16 && total <= 25) {
    return { inicio: total - 4, fim: total };
  }

  return null;
}

function faixaIdiomaFallback(total: number): FaixaIdiomaOpcional {
  if (total <= 0) return { inicio: 1, fim: 5 };
  if (total >= 40 && total <= 50) return { inicio: 1, fim: 5 };
  return { inicio: Math.max(1, total - 4), fim: total };
}

export type MetaPoliticaIdiomas = {
  politicaIdiomas?: PoliticaIdiomasProva | string;
  idiomaQuestaoInicio?: number | null;
  idiomaQuestaoFim?: number | null;
  ordemIdiomasFaixa?: "INGLES_PRIMEIRO" | "ESPANHOL_PRIMEIRO" | null;
};

export type QuestaoComVariante = {
  numero: number;
  idiomaVariante?: IdiomaVarianteQuestao | string;
};

export function temDuplicataEnEs(meta?: MetaPoliticaIdiomas): boolean {
  return meta?.politicaIdiomas === "DUPLICATA_EN_ES";
}

/** Extração gravou linhas INGLES + ESPANHOL (mesmo número impresso). */
export function questoesTemVariantesEnEs(
  questoes: { idiomaVariante?: string | null }[]
): boolean {
  let ing = false;
  let es = false;
  for (const q of questoes) {
    if (q.idiomaVariante === "INGLES") ing = true;
    if (q.idiomaVariante === "ESPANHOL") es = true;
    if (ing && es) return true;
  }
  return false;
}

/** Faixa Qn–Qm a partir dos números que têm par EN+ES no banco. */
export function inferirFaixaPorVariantesEnEs(
  questoes: { numero: number; idiomaVariante?: string | null }[]
): FaixaIdiomaOpcional | null {
  const porNumero = new Map<number, Set<string>>();
  for (const q of questoes) {
    const v = q.idiomaVariante ?? "COMUM";
    if (v !== "INGLES" && v !== "ESPANHOL") continue;
    if (!porNumero.has(q.numero)) porNumero.set(q.numero, new Set());
    porNumero.get(q.numero)!.add(v);
  }
  const nums = [...porNumero.entries()]
    .filter(([, vs]) => vs.has("INGLES") && vs.has("ESPANHOL"))
    .map(([n]) => n)
    .sort((a, b) => a - b);
  if (nums.length === 0) return null;
  return { inicio: nums[0], fim: nums[nums.length - 1] };
}

/** Faixa a partir de números que aparecem ≥2 vezes (duplicata física, ex. 70 linhas / 65 lógicas). */
export function inferirFaixaPorNumerosDuplicados(
  questoes: { numero: number }[]
): FaixaIdiomaOpcional | null {
  const counts = new Map<number, number>();
  for (const q of questoes) {
    counts.set(q.numero, (counts.get(q.numero) ?? 0) + 1);
  }
  const dup = [...counts.entries()]
    .filter(([, c]) => c >= 2)
    .map(([n]) => n)
    .sort((a, b) => a - b);
  if (dup.length === 0) return null;
  return { inicio: dup[0], fim: dup[dup.length - 1] };
}

/** Faixa EN/ES só quando início e fim estão explicitamente cadastrados (evita gabarito «travado» em 1–5). */
export function faixaIdiomaProva(meta?: MetaPoliticaIdiomas): FaixaIdiomaOpcional | null {
  if (!temDuplicataEnEs(meta)) return null;
  const inicio = meta?.idiomaQuestaoInicio;
  const fim = meta?.idiomaQuestaoFim;
  if (
    !Number.isInteger(inicio) ||
    !Number.isInteger(fim) ||
    inicio! < 1 ||
    fim! < inicio!
  ) {
    return null;
  }
  return { inicio: inicio!, fim: fim! };
}

export function faixaIdiomaConfirmada(meta?: MetaPoliticaIdiomas): boolean {
  return faixaIdiomaProva(meta) != null;
}

export type ConfiancaFaixaIdioma = "alta" | "media" | "baixa";

export type ResultadoInferenciaFaixa = {
  faixa: FaixaIdiomaOpcional;
  confianca: ConfiancaFaixaIdioma;
  motivo: string;
};

export type PropostaFaixaIdioma = ResultadoInferenciaFaixa & {
  numerosEstrangeiros: number[];
};

export function numeroNaFaixaIdioma(numero: number, faixa: FaixaIdiomaOpcional): boolean {
  return numero >= faixa.inicio && numero <= faixa.fim;
}

export function chaveQuestaoVariante(numero: number, variante: IdiomaVarianteQuestao | string): string {
  return `${numero}:${variante}`;
}

/**
 * Inferir faixa EN/ES a partir da leitura estrutural do PDF.
 * ENEM: Q1–5; UFU linguagens (20Q): Q16–20 após bloco de Português.
 */
export function inferirFaixaIdiomaComConfianca(
  estrutura: EstruturaProvaDetectada,
  opts?: InferirFaixaIdiomaOpts
): ResultadoInferenciaFaixa | null {
  if (estrutura.idiomas_estrangeiros !== "duplicata_ingles_espanhol") return null;

  const cadastro = opts?.faixaCadastro;
  if (
    cadastro &&
    cadastro.inicio > 0 &&
    cadastro.fim >= cadastro.inicio &&
    cadastro.fim - cadastro.inicio + 1 <= 15
  ) {
    return { faixa: cadastro, confianca: "alta", motivo: "faixa cadastrada manualmente na prova" };
  }

  const blocos = estrutura.blocos ?? [];
  const blocoPt = blocos.find((b) => blocoEhPortugues(b.titulo));
  const blocoIng = blocos.find((b) => blocoEhIngles(b.titulo));
  const blocoEsp = blocos.find((b) => blocoEhEspanhol(b.titulo));
  const maxNum = estrutura.numeros?.length
    ? Math.max(...estrutura.numeros.filter((n) => Number.isInteger(n) && n > 0 && n <= 500))
    : 0;

  if (blocoIng && blocoEsp) {
    let inicio = Math.max(blocoIng.questao_inicio, blocoEsp.questao_inicio);
    let fim = Math.min(blocoIng.questao_fim, blocoEsp.questao_fim);
    const ajustouAposPt = Boolean(blocoPt && inicio <= blocoPt.questao_fim);

    if (ajustouAposPt) {
      inicio = blocoPt!.questao_fim + 1;
      fim = Math.min(
        inicio + 4,
        blocoIng.questao_fim,
        blocoEsp.questao_fim,
        maxNum || inicio + 4
      );
    }

    const largura = fim - inicio + 1;
    if (inicio > 0 && fim >= inicio && largura >= 1 && largura <= 10) {
      return {
        faixa: { inicio, fim },
        confianca: ajustouAposPt || (!blocoPt && inicio === blocoIng.questao_inicio) ? "alta" : "media",
        motivo: ajustouAposPt
          ? `blocos EN/ES após «${blocoPt!.titulo}» (Q${inicio}–${fim})`
          : `interseção blocos «${blocoIng.titulo}» e «${blocoEsp.titulo}»`,
      };
    }
  }

  const blocoUnico = blocoIng ?? blocoEsp;
  if (blocoUnico) {
    const { questao_inicio: inicio, questao_fim: fim } = blocoUnico;
    const largura = fim - inicio + 1;
    if (inicio > 0 && fim >= inicio && largura <= 10 && (!blocoPt || inicio > blocoPt.questao_fim)) {
      return {
        faixa: { inicio, fim },
        confianca: "media",
        motivo: `bloco único «${blocoUnico.titulo}»`,
      };
    }
  }

  if (blocoPt && maxNum > blocoPt.questao_fim) {
    const inicio = blocoPt.questao_fim + 1;
    const fim = Math.min(inicio + 4, maxNum);
    if (fim >= inicio) {
      return {
        faixa: { inicio, fim },
        confianca: "media",
        motivo: `5 questões após bloco «${blocoPt.titulo}»`,
      };
    }
  }

  const heuristica = faixaIdiomaHeuristicaBanca(
    opts?.banca,
    opts?.totalEsperado ?? estrutura.total_questoes_detectado,
    estrutura.numeros
  );
  if (heuristica) {
    return { faixa: heuristica, confianca: "media", motivo: `heurística banca ${opts?.banca ?? ""}`.trim() };
  }

  const total = opts?.totalEsperado ?? estrutura.total_questoes_detectado ?? maxNum;
  const faixa = faixaIdiomaFallback(total);
  return {
    faixa,
    confianca: "baixa",
    motivo: `fallback por total (${total} questões)`,
  };
}

export function inferirFaixaIdiomaDoPdf(
  estrutura: EstruturaProvaDetectada,
  opts?: InferirFaixaIdiomaOpts
): FaixaIdiomaOpcional | null {
  return inferirFaixaIdiomaComConfianca(estrutura, opts)?.faixa ?? null;
}

/** Propõe faixa EN/ES pelos enunciados (catálogo/heurística EN·ES) — use antes de dividir trilhas. */
export function proporFaixaIdiomaPorConteudo(
  questoes: Array<{ numero: number; enunciado?: string | null; alternativas?: string | null }>,
  opts?: InferirFaixaIdiomaOpts & { estrutura?: EstruturaProvaDetectada }
): PropostaFaixaIdioma | null {
  const estrangeiros: number[] = [];

  for (const q of questoes) {
    const texto = `${q.enunciado ?? ""}\n${q.alternativas ?? ""}`.trim();
    if (texto.length < 40) continue;

    const heur = heuristicaLinguagensDisciplina(texto);
    if (heur?.disciplinaId === "ingles" || heur?.disciplinaId === "espanhol") {
      estrangeiros.push(q.numero);
      continue;
    }
    if (detectarPassagemIngles(texto) && !textoIndicaPortuguesInterpretacao(texto)) {
      estrangeiros.push(q.numero);
    } else if (detectarPassagemEspanhol(texto)) {
      estrangeiros.push(q.numero);
    }
  }

  const nums = [...new Set(estrangeiros)].sort((a, b) => a - b);
  if (nums.length === 0) {
    if (opts?.estrutura) {
      const inf = inferirFaixaIdiomaComConfianca(opts.estrutura, opts);
      if (inf) {
        return { ...inf, numerosEstrangeiros: [] };
      }
    }
    return null;
  }

  let bestStart = nums[0];
  let bestEnd = nums[0];
  let curStart = nums[0];
  let curEnd = nums[0];

  for (let i = 1; i < nums.length; i++) {
    if (nums[i] === curEnd + 1) {
      curEnd = nums[i];
    } else {
      if (curEnd - curStart >= bestEnd - bestStart) {
        bestStart = curStart;
        bestEnd = curEnd;
      }
      curStart = nums[i];
      curEnd = nums[i];
    }
  }
  if (curEnd - curStart >= bestEnd - bestStart) {
    bestStart = curStart;
    bestEnd = curEnd;
  }

  const faixa = { inicio: bestStart, fim: bestEnd };
  const largura = bestEnd - bestStart + 1;
  const naFaixa = nums.filter((n) => n >= bestStart && n <= bestEnd).length;
  const cobertura = largura > 0 ? naFaixa / largura : 0;

  let confianca: ConfiancaFaixaIdioma = "media";
  if (largura <= 10 && cobertura >= 0.75 && nums.length >= 3) confianca = "alta";
  if (largura > 12 || cobertura < 0.45) confianca = "baixa";

  return {
    faixa,
    confianca,
    motivo: `${nums.length} questão(ões) com texto EN/ES; faixa contígua Q${bestStart}–${bestEnd}`,
    numerosEstrangeiros: nums,
  };
}

/** Remove variantes EN/ES fora da faixa e consolida linhas COMUM na faixa duplicada. */
export function sanearVariantesIdiomaExtracao(
  rows: ProvaQuestaoRow[],
  faixa: FaixaIdiomaOpcional | null,
  avisos: string[],
  ordemFaixa?: "INGLES_PRIMEIRO" | "ESPANHOL_PRIMEIRO" | null
): ProvaQuestaoRow[] {
  if (!faixa) return rows;

  const byChave = new Map(
    rows.map((r) => [chaveQuestaoVariante(r.numero, r.idiomaVariante ?? "COMUM"), r])
  );
  const numeros = [...new Set(rows.map((r) => r.numero))].sort((a, b) => a - b);
  const out: ProvaQuestaoRow[] = [];

  for (const numero of numeros) {
    const naFaixa = numeroNaFaixaIdioma(numero, faixa);
    const comum = byChave.get(chaveQuestaoVariante(numero, "COMUM"));
    const ing = byChave.get(chaveQuestaoVariante(numero, "INGLES"));
    const esp = byChave.get(chaveQuestaoVariante(numero, "ESPANHOL"));

    if (!naFaixa) {
      if (comum) {
        out.push(comum);
      } else if (ing || esp) {
        const candidato = ing ?? esp!;
        const texto = `${candidato.enunciado ?? ""}\n${candidato.alternativas ?? ""}`;
        out.push({ ...candidato, idiomaVariante: "COMUM" });
        avisos.push(
          `Q${numero}: trilha ${ing ? "INGLES" : "ESPANHOL"} fora da faixa ${faixa.inicio}–${faixa.fim} → consolidada como COMUM.` +
            (textoIndicaPortuguesInterpretacao(texto) ? " (texto em português)" : "")
        );
      }
      continue;
    }

    if (ing) {
      const textoIng = ing.enunciado ?? "";
      if (textoIndicaPortuguesInterpretacao(textoIng) && !detectarPassagemIngles(textoIng)) {
        avisos.push(`Q${numero} (INGLES): enunciado parece português — confira na validação.`);
      }
      out.push(ing);
    }
    if (esp) {
      const textoEsp = esp.enunciado ?? "";
      if (textoIndicaPortuguesInterpretacao(textoEsp) && !detectarPassagemEspanhol(textoEsp)) {
        avisos.push(`Q${numero} (ESPANHOL): enunciado parece português — confira na validação.`);
      }
      out.push(esp);
    }
    if (!ing && !esp && comum) {
      out.push(comum);
      avisos.push(
        `Q${numero}: só linha COMUM na faixa EN/ES (${faixa.inicio}–${faixa.fim}) — faltam variantes INGLES/ESPANHOL.`
      );
    }
  }

  return out.sort((a, b) => compararQuestoesPorNumeroEOrdem(a, b, ordemFaixa));
}

/** Ordem física dos blocos EN/ES no PDF (espanhol antes do inglês em alguns vestibulares). */
export function inferirOrdemIdiomasDoPdf(
  estrutura: EstruturaProvaDetectada
): "INGLES_PRIMEIRO" | "ESPANHOL_PRIMEIRO" {
  if (estrutura.idiomas_estrangeiros !== "duplicata_ingles_espanhol") {
    return "INGLES_PRIMEIRO";
  }
  const blocos = estrutura.blocos ?? [];
  const norm = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");
  let idxIng = -1;
  let idxEsp = -1;
  blocos.forEach((b, i) => {
    const t = norm(b.titulo);
    if (/ingles|ingl/.test(t)) idxIng = i;
    if (/espanhol|espan/.test(t)) idxEsp = i;
  });
  if (idxEsp >= 0 && idxIng >= 0 && idxEsp < idxIng) return "ESPANHOL_PRIMEIRO";
  return "INGLES_PRIMEIRO";
}

export function varianteParaNumero(
  numero: number,
  meta: MetaPoliticaIdiomas,
  idiomaEstrangeiro?: IdiomaVarianteQuestao | null
): IdiomaVarianteQuestao {
  const faixa = faixaIdiomaProva(meta);
  if (faixa && numeroNaFaixaIdioma(numero, faixa)) {
    return idiomaEstrangeiro === "ESPANHOL" ? "ESPANHOL" : "INGLES";
  }
  return "COMUM";
}

/** Questões efetivas para correção / diagnóstico (uma por número lógico). */
export function questoesParaTentativa<
  T extends QuestaoComVariante & { id: string; materia: string; assunto: string; gabarito: string | null },
>(
  questoes: T[],
  meta: MetaPoliticaIdiomas,
  idiomaEstrangeiro?: IdiomaVarianteQuestao | null
): T[] {
  const faixa = faixaIdiomaProva(meta);
  const byKey = new Map(questoes.map((q) => [chaveQuestaoVariante(q.numero, q.idiomaVariante ?? "COMUM"), q]));

  const numeros = [...new Set(questoes.map((q) => q.numero))].sort((a, b) => a - b);

  const out: T[] = [];
  for (const numero of numeros) {
    const variante = varianteParaNumero(numero, meta, idiomaEstrangeiro);
    const q = byKey.get(chaveQuestaoVariante(numero, variante));
    if (q) {
      out.push(q);
      continue;
    }
    // Legado: prova sem variantes explícitas — uma linha COMUM por número
    const legado = byKey.get(chaveQuestaoVariante(numero, "COMUM"));
    if (legado) out.push(legado);
  }
  return out.sort((a, b) => a.numero - b.numero);
}

export function questaoPorNumeroETentativa<
  T extends QuestaoComVariante,
>(questoes: T[], numero: number, meta: MetaPoliticaIdiomas, idiomaEstrangeiro?: IdiomaVarianteQuestao | null): T | undefined {
  const variante = varianteParaNumero(numero, meta, idiomaEstrangeiro);
  return (
    questoes.find((q) => q.numero === numero && (q.idiomaVariante ?? "COMUM") === variante) ??
    questoes.find((q) => q.numero === numero && (q.idiomaVariante ?? "COMUM") === "COMUM")
  );
}

/** Linhas do banco exigidas para considerar a prova «completa» (admin). */
export function variantesExigidasPorNumero(
  numero: number,
  meta: MetaPoliticaIdiomas
): IdiomaVarianteQuestao[] {
  const faixa = faixaIdiomaProva(meta);
  if (faixa && numeroNaFaixaIdioma(numero, faixa)) {
    return ["INGLES", "ESPANHOL"];
  }
  return ["COMUM"];
}

export function labelVarianteQuestao(variante: IdiomaVarianteQuestao | string): string {
  if (variante === "INGLES") return "Inglês";
  if (variante === "ESPANHOL") return "Espanhol";
  return "";
}

export function labelIdiomaEstrangeiroEscolha(variante: IdiomaVarianteQuestao): string {
  return variante === "ESPANHOL" ? "Espanhol" : "Inglês";
}

/** Matéria cadastrada → trilha EN/ES (null se não for língua estrangeira). */
export function materiaParaVarianteIdioma(materia: string): IdiomaVarianteQuestao | null {
  const m = materia.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  if (m === "ingles" || m === "lingua inglesa" || m === "lingua estrangeira: ingles") {
    return "INGLES";
  }
  if (m === "espanhol" || m === "lingua espanhola" || m === "lingua estrangeira: espanhol") {
    return "ESPANHOL";
  }
  if (m.includes("ingles") && !m.includes("espanhol")) return "INGLES";
  if (m.includes("espanhol")) return "ESPANHOL";
  return null;
}

export function varianteInconsistenteComMateria(
  materia: string,
  variante: IdiomaVarianteQuestao | string
): boolean {
  const esperada = materiaParaVarianteIdioma(materia);
  if (!esperada) return false;
  return (variante ?? "COMUM") !== esperada;
}

export function ordemVariantesFaixa(
  ordemFaixa?: "INGLES_PRIMEIRO" | "ESPANHOL_PRIMEIRO" | null
): IdiomaVarianteQuestao[] {
  return ordemFaixa === "ESPANHOL_PRIMEIRO"
    ? ["ESPANHOL", "INGLES"]
    : ["INGLES", "ESPANHOL"];
}

export function compararQuestoesPorNumeroEOrdem(
  a: { numero: number; idiomaVariante?: string | null },
  b: { numero: number; idiomaVariante?: string | null },
  ordemFaixa?: "INGLES_PRIMEIRO" | "ESPANHOL_PRIMEIRO" | null
): number {
  if (a.numero !== b.numero) return a.numero - b.numero;
  const ordem = ordemVariantesFaixa(ordemFaixa);
  const peso = (v?: string | null) => {
    const i = ordem.indexOf((v ?? "COMUM") as IdiomaVarianteQuestao);
    return i >= 0 ? i : ordem.length;
  };
  const pa = a.idiomaVariante === "COMUM" ? -1 : peso(a.idiomaVariante);
  const pb = b.idiomaVariante === "COMUM" ? -1 : peso(b.idiomaVariante);
  if (pa !== pb) return pa - pb;
  return (a.idiomaVariante ?? "").localeCompare(b.idiomaVariante ?? "");
}
