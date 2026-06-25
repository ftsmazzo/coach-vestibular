import { taxonomy, TipoErroId } from "./taxonomy";
import { normalizarGabaritoOficial } from "./gabarito-anulada";

export interface QuestaoInput {
  numero: number;
  correto: boolean;
  materiaId?: string;
  temaId?: string;
  tipoErro?: TipoErroId;
}

/** Ex.: "3, 5, 8-12, 40" ou uma questão por linha */
export function parseListaErros(texto: string): number[] {
  const result = new Set<number>();
  const cleaned = texto.trim();
  if (!cleaned) return [];

  const tokens = cleaned.split(/[\s,;]+/).filter(Boolean);
  for (const token of tokens) {
    const rangeMatch = token.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      for (let n = Math.min(start, end); n <= Math.max(start, end); n++) {
        result.add(n);
      }
      continue;
    }
    const num = parseInt(token.replace(/\D/g, ""), 10);
    if (!isNaN(num) && num > 0) result.add(num);
  }
  return [...result].sort((a, b) => a - b);
}

/**
 * Gabarito do aluno ou oficial em lote — uma linha por questão.
 * Ex.: 1,C | 2, A | 3;B | 12.D | 15,* (anulada)
 * Dual EN/ES: 16,C,en | 16,B,es | 17;D;ingles
 */
export function parseGabaritoLote(texto: string): Map<number, string> {
  const map = new Map<number, string>();
  for (const linha of texto.split(/\r?\n/)) {
    const trimmed = linha.trim();
    if (!trimmed) continue;

    if (parseGabaritoLinhaDual(trimmed)) continue;

    const matchAnulada =
      trimmed.match(/^(\d{1,3})\s*[,;\s]+\s*(\*|anulad[ao]?)\b/i) ??
      trimmed.match(/^(\d{1,3})\s*[\.\):\-–]\s*(\*|anulad[ao]?)\b/i);
    if (matchAnulada) {
      const numero = parseInt(matchAnulada[1], 10);
      if (numero > 0) map.set(numero, "*");
      continue;
    }

    const match =
      trimmed.match(/^(\d{1,3})\s*[,;\s]+\s*([A-Ea-e])\b/i) ??
      trimmed.match(/^(\d{1,3})\s*[\.\):\-–]\s*([A-Ea-e])\b/i);

    if (!match) continue;
    const numero = parseInt(match[1], 10);
    const letra = match[2].toUpperCase();
    if (numero > 0 && /^[A-E]$/.test(letra)) {
      map.set(numero, letra);
    }
  }
  return map;
}

export type GabaritoDualLinha = {
  numero: number;
  comum?: string;
  ingles?: string;
  espanhol?: string;
};

function parseTrilhaGabarito(raw: string): "ingles" | "espanhol" | null {
  const t = raw.trim().toLowerCase();
  if (t === "en" || t === "ingles" || t === "inglês" || t === "ing") return "ingles";
  if (t === "es" || t === "espanhol" || t === "esp") return "espanhol";
  return null;
}

function parseGabaritoLinhaDual(trimmed: string): GabaritoDualLinha | null {
  const match =
    trimmed.match(/^(\d{1,3})\s*[,;\s]+\s*([A-Ea-e]|\*)\s*[,;\s]+\s*(en|es|ingles|espanhol|ing|esp)\b/i) ??
    trimmed.match(/^(\d{1,3})\s*[,;\s]+\s*(en|es|ingles|espanhol|ing|esp)\s*[,;\s]+\s*([A-Ea-e]|\*)\b/i);
  if (!match) return null;

  const numero = parseInt(match[1], 10);
  if (numero <= 0) return null;

  let letraRaw: string;
  let trilhaRaw: string;
  if (/^(en|es|ingles|espanhol)/i.test(match[2])) {
    trilhaRaw = match[2];
    letraRaw = match[3];
  } else {
    letraRaw = match[2];
    trilhaRaw = match[3];
  }

  const trilha = parseTrilhaGabarito(trilhaRaw);
  if (!trilha) return null;

  const letra =
    letraRaw === "*" || /^anulad/i.test(letraRaw) ? "*" : letraRaw.toUpperCase();
  if (letra !== "*" && !/^[A-E]$/.test(letra)) return null;

  return trilha === "ingles"
    ? { numero, ingles: letra }
    : { numero, espanhol: letra };
}

/** Gabarito com trilhas EN/ES explícitas (ex.: 16,C,en). Linhas só com número,letra vão em comum. */
export function parseGabaritoLoteDual(texto: string): Map<number, GabaritoDualLinha> {
  const map = new Map<number, GabaritoDualLinha>();
  const simples = parseGabaritoLote(texto);

  for (const linha of texto.split(/\r?\n/)) {
    const trimmed = linha.trim();
    if (!trimmed) continue;
    const dual = parseGabaritoLinhaDual(trimmed);
    if (!dual) continue;
    const prev = map.get(dual.numero) ?? { numero: dual.numero };
    map.set(dual.numero, {
      numero: dual.numero,
      comum: prev.comum,
      ingles: dual.ingles ?? prev.ingles,
      espanhol: dual.espanhol ?? prev.espanhol,
    });
  }

  for (const [numero, letra] of simples) {
    if (map.has(numero)) continue;
    map.set(numero, { numero, comum: letra });
  }

  return map;
}

/** Converte sequência contínua A–E para mapa por número das questões (ordem crescente). */
export function sequenciaParaMapaPorNumero(
  questoesOrdenadas: { numero: number }[],
  textoRespostas: string
): Map<number, string> {
  const letras = normalizarAlternativas(textoRespostas);
  const map = new Map<number, string>();
  for (let i = 0; i < questoesOrdenadas.length && i < letras.length; i++) {
    map.set(questoesOrdenadas[i].numero, letras[i]);
  }
  return map;
}

/** Normaliza sequência de alternativas (A–E), ignora espaços e quebras */
export function normalizarAlternativas(texto: string): string {
  return texto
    .toUpperCase()
    .replace(/[^A-E]/g, "")
    .slice(0, 500);
}

/** Compara gabarito oficial com respostas do aluno */
export function compararGabarito(
  gabaritoOficial: string,
  respostasAluno: string,
  totalQuestoes: number
): QuestaoInput[] {
  const oficial = normalizarAlternativas(gabaritoOficial);
  const aluno = normalizarAlternativas(respostasAluno);
  const questoes: QuestaoInput[] = [];

  for (let i = 0; i < totalQuestoes; i++) {
    const numero = i + 1;
    const g = oficial[i];
    const a = aluno[i];
    let correto = false;
    if (g && a) {
      correto = g === a;
    } else if (!g && !a) {
      correto = true;
    } else if (!a) {
      correto = false;
    } else {
      correto = false;
    }
    questoes.push({ numero, correto });
  }
  return questoes;
}

/** Monta questões: todas certas exceto as listadas como erro */
export function questoesFromListaErros(
  totalQuestoes: number,
  erros: number[]
): QuestaoInput[] {
  const erroSet = new Set(erros);
  return Array.from({ length: totalQuestoes }, (_, i) => ({
    numero: i + 1,
    correto: !erroSet.has(i + 1),
  }));
}

/** Mapa ENEM prova completa (180) — área aproximada por número */
export function inferirMateriaEnem180(numero: number): string | undefined {
  if (numero >= 1 && numero <= 45) return "portugues";
  if (numero >= 46 && numero <= 90) return "historia";
  if (numero >= 91 && numero <= 135) return "biologia";
  if (numero >= 136 && numero <= 180) return "matematica";
  return undefined;
}

/** Simulado tipo cursinho 60 questões — 20 natureza, 20 mat, 20 linguagens (comum) */
export function inferirMateriaSimulado60(numero: number): string | undefined {
  if (numero <= 20) return "portugues";
  if (numero <= 40) return "biologia";
  return "matematica";
}

export function aplicarMapaEnem(questoes: QuestaoInput[], total: number): QuestaoInput[] {
  return questoes.map((q) => {
    if (!q.correto) {
      const materiaId =
        total === 180
          ? inferirMateriaEnem180(q.numero)
          : total === 60
            ? inferirMateriaSimulado60(q.numero)
            : undefined;
      return { ...q, materiaId };
    }
    return q;
  });
}

const TEMA_ALIASES: Record<string, { materiaId: string; temaId: string }> = {};
for (const m of taxonomy.materias) {
  for (const t of m.temas) {
    const key = t.label
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");
    TEMA_ALIASES[key] = { materiaId: m.id, temaId: t.id };
    TEMA_ALIASES[t.id.replace(/_/g, " ")] = { materiaId: m.id, temaId: t.id };
  }
}

function resolverTema(texto: string): { materiaId: string; temaId: string } | null {
  const n = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
  if (TEMA_ALIASES[n]) return TEMA_ALIASES[n];
  for (const [alias, ref] of Object.entries(TEMA_ALIASES)) {
    if (n.includes(alias) || alias.includes(n)) return ref;
  }
  for (const m of taxonomy.materias) {
    const mn = m.label
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");
    if (n.includes(mn)) {
      return { materiaId: m.id, temaId: m.temas[0]?.id ?? "" };
    }
  }
  return null;
}

/**
 * Cola saída de GPT/assistente. Ex.:
 * Q3 - Estequiometria
 * Questão 8: Cinemática (interpretação)
 * 12) Fisiologia Humana - base teórica
 */
export function parseAnaliseAssistente(texto: string): Map<number, Partial<QuestaoInput>> {
  const map = new Map<number, Partial<QuestaoInput>>();
  const linhas = texto.split(/\n/).map((l) => l.trim()).filter(Boolean);

  for (const linha of linhas) {
    const numMatch = linha.match(/(?:quest[aã]o|q\.?|#)?\s*(\d{1,3})/i);
    if (!numMatch) continue;
    const numero = parseInt(numMatch[1], 10);
    const resto = linha.slice(numMatch.index! + numMatch[0].length);

    const tema = resolverTema(resto.replace(/^[\s:\-–]+/, ""));
    const tipoMatch = resto.match(
      /teoria|conceito|te[oó]rico|c[aá]lculo|bobeira|aten[cç][aã]o|interpreta[cç][aã]o|enunciado|d[uú]vida|crucial|chute|tempo/i
    );
    let tipoErro: QuestaoInput["tipoErro"];
    if (tipoMatch) {
      const t = tipoMatch[0].toLowerCase();
      if (t.includes("teor") || t.includes("conceito")) tipoErro = "CONCEITO_TEORICO";
      else if (t.includes("calculo") || t.includes("bobeira") || t.includes("aten")) tipoErro = "CALCULO_BOBEIRA";
      else if (t.includes("interpret") || t.includes("enunciado")) tipoErro = "INTERPRETACAO_ENUNCIADO";
      else if (t.includes("duvida") || t.includes("crucial")) tipoErro = "DUVIDA_CRUCIAL";
      else if (t.includes("chute")) tipoErro = "CHUTE_TOTAL";
      else if (t.includes("tempo")) tipoErro = "FALTA_TEMPO";
    }

    map.set(numero, {
      numero,
      correto: false,
      materiaId: tema?.materiaId,
      temaId: tema?.temaId,
      tipoErro,
    });
  }
  return map;
}

export function mesclarComAnalise(
  base: QuestaoInput[],
  analise: Map<number, Partial<QuestaoInput>>
): QuestaoInput[] {
  return base.map((q) => {
    const extra = analise.get(q.numero);
    if (!extra) return q;
    return { ...q, ...extra, numero: q.numero, correto: q.correto };
  });
}
