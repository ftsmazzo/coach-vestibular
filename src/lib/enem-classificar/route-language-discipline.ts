import type { EscopoIndexEntry, MateriaCatalogo } from "@/lib/conhecimento-catalog/types";
import { naFaixaL2Enem } from "./linguagens-rota";

export type DisciplinaLinguagens = "portugues" | "ingles" | "espanhol" | "indefinido";

export type DisciplinaLinguagensRoteada = Exclude<DisciplinaLinguagens, "indefinido">;

type RotasLinguagens = Record<DisciplinaLinguagensRoteada, string[]>;

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

const ROTAS_PADRAO: RotasLinguagens = {
  portugues: ["pt_interp", "pt_lit", "pt_gram", "pt_sem", "pt_art", "pt_tec"],
  ingles: ["l2_en"],
  espanhol: ["l2_es"],
};

function rotasDoCatalogo(catalog?: MateriaCatalogo): RotasLinguagens {
  const rotas = catalog?.regras?.roteamentoObrigatorio?.rotas;
  if (!rotas) return ROTAS_PADRAO;
  return {
    portugues: rotas.portugues ?? ROTAS_PADRAO.portugues,
    ingles: rotas.ingles ?? ROTAS_PADRAO.ingles,
    espanhol: rotas.espanhol ?? ROTAS_PADRAO.espanhol,
  };
}

function metadadoL2Explicito(
  input: QuestaoRotaInput
): { disciplina: DisciplinaLinguagensRoteada; confianca: number } | null {
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

  const idioma = input.idioma?.toLowerCase();
  if (idioma === "ingles") return { disciplina: "ingles", confianca: 0.99 };
  if (idioma === "espanhol") return { disciplina: "espanhol", confianca: 0.99 };

  return null;
}

function metadadoPortuguesExplicito(
  input: QuestaoRotaInput
): { disciplina: DisciplinaLinguagensRoteada; confianca: number } | null {
  const raw = (input.disciplinaOriginalId ?? "").toLowerCase().trim();
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
  return null;
}

function montarRota(
  rotas: RotasLinguagens,
  disciplina: DisciplinaLinguagens,
  criterio: CriterioRotaLinguagens,
  confianca: number,
  sinalizadorRevisao: boolean,
  justificativa: string
): RotaLinguagens {
  if (disciplina === "indefinido") {
    return {
      catalogoMateriaId: "linguagens",
      disciplinaOriginalId: "indefinido",
      allowedAssuntoIds: [],
      criterio,
      confianca,
      sinalizadorRevisao,
      justificativa,
    };
  }
  return {
    catalogoMateriaId: "linguagens",
    disciplinaOriginalId: disciplina,
    allowedAssuntoIds: rotas[disciplina],
    criterio,
    confianca,
    sinalizadorRevisao,
    justificativa,
  };
}

/**
 * @deprecated Não usar para classificar — Linguagens usa classificarLoteLinguagensV12 (IA).
 * Mantido apenas para referência de validação de escopos por assuntoId.
 */
export function routeLanguageDiscipline(
  input: QuestaoRotaInput,
  catalog?: MateriaCatalogo
): RotaLinguagens {
  const rotas = rotasDoCatalogo(catalog);
  const numero = input.numero;

  const metaL2 = metadadoL2Explicito(input);
  if (metaL2) {
    return montarRota(
      rotas,
      metaL2.disciplina,
      "metadata",
      metaL2.confianca,
      false,
      `Metadado enem.dev: idioma=${input.idioma ?? "—"}`
    );
  }

  const metaPt = metadadoPortuguesExplicito(input);
  if (metaPt) {
    return montarRota(
      rotas,
      metaPt.disciplina,
      "metadata",
      metaPt.confianca,
      false,
      `Metadado PT: disciplina=${input.disciplinaOriginalId ?? "—"}`
    );
  }

  if (numero != null && !naFaixaL2Enem(numero)) {
    return montarRota(
      rotas,
      "portugues",
      "posicao_enem",
      0.95,
      false,
      `Q${numero} (Q6–45) idioma COMUM → português/artes/tecnologias.`
    );
  }

  if (numero != null && naFaixaL2Enem(numero)) {
    return montarRota(
      rotas,
      "indefinido",
      "incerto",
      0.2,
      true,
      `Q${numero} (Q1–5) idioma COMUM — reimportar/sync enem.dev (ES ou EN).`
    );
  }

  return montarRota(
    rotas,
    "indefinido",
    "incerto",
    0.15,
    true,
    "Sem metadado de idioma nem posição ENEM."
  );
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
