import type { EscopoIndexEntry, MateriaCatalogo } from "@/lib/conhecimento-catalog/types";

export type DisciplinaLinguagens = "portugues" | "ingles" | "espanhol" | "indefinido";

export type DisciplinaLinguagensRoteada = Exclude<DisciplinaLinguagens, "indefinido">;

type RotasLinguagens = Record<DisciplinaLinguagensRoteada, string[]>;

export type CriterioRotaLinguagens =
  | "metadata"
  | "idioma_texto_base"
  | "conteudo_cobrado"
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

/** Monta objeto RotaLinguagens a partir da saída IA v12 (validação pós-classificação). */
export function rotaFromIaV12(
  disciplina: DisciplinaLinguagens,
  criterio: CriterioRotaLinguagens,
  confianca: number,
  justificativa: string,
  catalog?: MateriaCatalogo
): RotaLinguagens {
  const rotas = rotasDoCatalogo(catalog);
  if (disciplina === "indefinido") {
    return {
      catalogoMateriaId: "linguagens",
      disciplinaOriginalId: "indefinido",
      allowedAssuntoIds: [],
      criterio,
      confianca,
      sinalizadorRevisao: true,
      justificativa,
    };
  }
  return {
    catalogoMateriaId: "linguagens",
    disciplinaOriginalId: disciplina,
    allowedAssuntoIds: rotas[disciplina],
    criterio,
    confianca,
    sinalizadorRevisao: confianca < 0.45,
    justificativa,
  };
}

export function versaoClassificacaoComRota(
  versaoBase: string,
  rota: RotaLinguagens
): string {
  return `${versaoBase}|disc=${rota.disciplinaOriginalId}|crit=${rota.criterio}|rc=${rota.confianca.toFixed(2)}`;
}
