import type { EscopoIndexEntry, MateriaCatalogo } from "@/lib/conhecimento-catalog/types";
import { naFaixaL2Enem } from "./linguagens-rota";

export type DisciplinaLinguagens = "portugues" | "ingles" | "espanhol" | "indefinido";

export type CriterioRotaLinguagens =
  | "metadata"
  | "posicao_enem"
  | "idioma_texto_base"
  | "inferido"
  | "incerto";

export type RotaLinguagens = {
  catalogoMateriaId: "linguagens";
  disciplinaOriginalId: DisciplinaLinguagens;
  allowedAssuntoIds: string[];
  criterio: CriterioRotaLinguagens;
  confianca: number;
  sinalizadorRevisao: boolean;
  justificativa: string;
};

export type QuestaoRotaInput = {
  disciplinaOriginalId?: string | null;
  idioma?: string | null;
  numero?: number;
  textoBase?: string;
  enunciado?: string;
  alternativas?: string;
  origem?: string;
};

const ROTAS_PADRAO: Record<Exclude<DisciplinaLinguagens, "indefinido">, string[]> = {
  portugues: ["pt_interp", "pt_lit", "pt_gram", "pt_sem", "pt_art", "pt_tec"],
  ingles: ["l2_en"],
  espanhol: ["l2_es"],
};

const MARCADORES_EN = [
  "the",
  "of",
  "and",
  "to",
  "with",
  "should",
  "would",
  "that",
  "this",
  "from",
  "their",
  "which",
];
const MARCADORES_ES = [
  "el",
  "la",
  "los",
  "las",
  "que",
  "para",
  "una",
  "porque",
  "según",
  "también",
  "del",
  "como",
  "está",
  "son",
];

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function rotasDoCatalogo(catalog?: MateriaCatalogo): typeof ROTAS_PADRAO {
  const rotas = catalog?.regras?.roteamentoObrigatorio?.rotas;
  if (!rotas) return ROTAS_PADRAO;
  return {
    portugues: rotas.portugues ?? ROTAS_PADRAO.portugues,
    ingles: rotas.ingles ?? ROTAS_PADRAO.ingles,
    espanhol: rotas.espanhol ?? ROTAS_PADRAO.espanhol,
  };
}

function disciplinaPorMetadado(
  input: QuestaoRotaInput
): { disciplina: DisciplinaLinguagens; confianca: number } | null {
  const raw = (input.disciplinaOriginalId ?? "").toLowerCase().trim();
  if (
    raw === "ingles" ||
    raw === "english" ||
    raw === "en" ||
    raw.includes("lingua_inglesa")
  ) {
    return { disciplina: "ingles", confianca: 0.99 };
  }
  if (
    raw === "espanhol" ||
    raw === "spanish" ||
    raw === "es" ||
    raw.includes("lingua_espanhola")
  ) {
    return { disciplina: "espanhol", confianca: 0.99 };
  }
  if (
    raw === "portugues" ||
    raw === "redacao" ||
    raw === "literatura" ||
    raw === "gramatica" ||
    raw === "artes" ||
    raw === "lp"
  ) {
    return { disciplina: "portugues", confianca: 0.99 };
  }

  const idioma = input.idioma?.toLowerCase();
  if (idioma === "ingles") return { disciplina: "ingles", confianca: 0.99 };
  if (idioma === "espanhol") return { disciplina: "espanhol", confianca: 0.99 };
  if (idioma === "comum") return { disciplina: "portugues", confianca: 0.95 };

  return null;
}

function textoParaDeteccao(input: QuestaoRotaInput): string {
  const partes = [input.textoBase, input.enunciado, input.alternativas].filter(Boolean);
  return norm(partes.join(" "));
}

function contarMarcadores(texto: string, marcadores: string[]): number {
  let n = 0;
  for (const m of marcadores) {
    const re = new RegExp(`\\b${m}\\b`, "g");
    const matches = texto.match(re);
    if (matches) n += matches.length;
  }
  if (texto.includes("¿") || texto.includes("¡")) n += 3;
  return n;
}

function detectarIdiomaTextoBase(
  input: QuestaoRotaInput
): { disciplina: DisciplinaLinguagens; confianca: number } | null {
  const texto = textoParaDeteccao(input);
  if (texto.length < 40) return null;

  const en = contarMarcadores(texto, MARCADORES_EN);
  const es = contarMarcadores(texto, MARCADORES_ES);

  if (en >= 4 && en > es * 1.5) {
    return { disciplina: "ingles", confianca: Math.min(0.92, 0.55 + en * 0.04) };
  }
  if (es >= 4 && es > en * 1.5) {
    return { disciplina: "espanhol", confianca: Math.min(0.92, 0.55 + es * 0.04) };
  }
  if (en >= 2 && es === 0) return { disciplina: "ingles", confianca: 0.72 };
  if (es >= 2 && en === 0) return { disciplina: "espanhol", confianca: 0.72 };

  return null;
}

/**
 * Etapa 1 — roteamento obrigatório antes de classificar escopo N2 em Linguagens.
 * O comando em português NÃO define a rota; prioriza metadado, posição ENEM e texto-base.
 */
export function routeLanguageDiscipline(
  input: QuestaoRotaInput,
  catalog?: MateriaCatalogo
): RotaLinguagens {
  const rotas = rotasDoCatalogo(catalog);
  const numero = input.numero;

  const meta = disciplinaPorMetadado(input);
  if (meta) {
    return {
      catalogoMateriaId: "linguagens",
      disciplinaOriginalId: meta.disciplina,
      allowedAssuntoIds: rotas[meta.disciplina],
      criterio: "metadata",
      confianca: meta.confianca,
      sinalizadorRevisao: false,
      justificativa: `Metadado: idioma=${input.idioma ?? "—"} disciplina=${input.disciplinaOriginalId ?? "—"}`,
    };
  }

  if (numero != null && !naFaixaL2Enem(numero)) {
    return {
      catalogoMateriaId: "linguagens",
      disciplinaOriginalId: "portugues",
      allowedAssuntoIds: rotas.portugues,
      criterio: "posicao_enem",
      confianca: 0.88,
      sinalizadorRevisao: false,
      justificativa: `Questão ${numero} fora da faixa L2 (Q6+ → português/artes/tecnologias).`,
    };
  }

  const detectado = detectarIdiomaTextoBase(input);
  if (detectado) {
    const revisao =
      numero != null && naFaixaL2Enem(numero) && detectado.confianca < 0.8;
    return {
      catalogoMateriaId: "linguagens",
      disciplinaOriginalId: detectado.disciplina,
      allowedAssuntoIds: rotas[detectado.disciplina],
      criterio: "idioma_texto_base",
      confianca: detectado.confianca,
      sinalizadorRevisao: revisao,
      justificativa: `Idioma dominante no texto-base/alternativas (EN/ES), ignorando comando PT.`,
    };
  }

  if (numero != null && naFaixaL2Enem(numero)) {
    return {
      catalogoMateriaId: "linguagens",
      disciplinaOriginalId: "indefinido",
      allowedAssuntoIds: [],
      criterio: "incerto",
      confianca: 0.2,
      sinalizadorRevisao: true,
      justificativa: `Q${numero} na faixa L2 sem metadado de idioma nem texto detectável.`,
    };
  }

  return {
    catalogoMateriaId: "linguagens",
    disciplinaOriginalId: "indefinido",
    allowedAssuntoIds: [],
    criterio: "incerto",
    confianca: 0.15,
    sinalizadorRevisao: true,
    justificativa: "Rota incerta — sem metadado, posição ou texto-base suficiente.",
  };
}

/** Filtra escopos N2 permitidos para a rota (inclui fallback). */
export function filtrarEscoposPorRota(
  escopos: Map<string, EscopoIndexEntry>,
  rota: RotaLinguagens
): Map<string, EscopoIndexEntry> {
  if (rota.disciplinaOriginalId === "indefinido" || rota.allowedAssuntoIds.length === 0) {
    const out = new Map<string, EscopoIndexEntry>();
    for (const [id, e] of escopos) {
      if (e.ehFallback) out.set(id, e);
    }
    return out;
  }

  const allowed = new Set(rota.allowedAssuntoIds);
  const out = new Map<string, EscopoIndexEntry>();
  for (const [id, e] of escopos) {
    if (e.ehFallback || allowed.has(e.assuntoId)) {
      out.set(id, e);
    }
  }
  return out;
}

/** Valida se o escopo classificado pertence à rota; senão força revisão. */
export function validarEscopoNaRota(
  resultado: { escopoId: string | null; assuntoId: string | null },
  rota: RotaLinguagens,
  escopos: Map<string, EscopoIndexEntry>,
  fallbackId: string
): boolean {
  if (!resultado.escopoId || resultado.escopoId === fallbackId) return true;
  const entry = escopos.get(resultado.escopoId);
  if (!entry) return false;
  if (entry.ehFallback) return true;
  if (rota.disciplinaOriginalId === "indefinido") return false;
  return rota.allowedAssuntoIds.includes(entry.assuntoId);
}

export function versaoClassificacaoComRota(
  versaoBase: string,
  rota: RotaLinguagens
): string {
  return `${versaoBase}|disc=${rota.disciplinaOriginalId}|crit=${rota.criterio}|rc=${rota.confianca.toFixed(2)}`;
}
