import { taxonomy } from "./taxonomy";

export interface QuestaoInput {
  numero: number;
  correto: boolean;
  materiaId?: string;
  temaId?: string;
  tipoErro?: "base_teorica" | "interpretacao" | "atencao" | "tempo";
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
      /base\s*te[oó]rica|interpreta[cç][aã]o|aten[cç][aã]o|tempo|bobeira/i
    );
    let tipoErro: QuestaoInput["tipoErro"];
    if (tipoMatch) {
      const t = tipoMatch[0].toLowerCase();
      if (t.includes("interpret")) tipoErro = "interpretacao";
      else if (t.includes("aten") || t.includes("bobeira")) tipoErro = "atencao";
      else if (t.includes("tempo")) tipoErro = "tempo";
      else tipoErro = "base_teorica";
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
