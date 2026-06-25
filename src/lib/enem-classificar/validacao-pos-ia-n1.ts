/**
 * Pós-validação determinística da saída da IA no N1.
 * Corrige apenas padrões fortes testados em provas reais.
 */

import {
  fisicaPrevaleceSobreMatematica,
  REGRA_FISICA_PREVALECE_ID,
} from "@/lib/enem-classificar/fisica-vs-matematica";
import { desempateTriagemNatureza } from "@/lib/enem-classificar/triagem-natureza-desempate";
import type { MateriaNatureza, TriagemNatureza } from "@/lib/enem-classificar/triagem-natureza";
import {
  triarNaturezaTransversal,
  REGRA_NATUREZA_TRANSVERSAL_ID,
} from "@/lib/enem-classificar/triagem-natureza-transversal";
import type { MateriaCorpusId } from "@/lib/enem-corpus-materia";

export const CONFIANCA_HEURISTICA_NATUREZA_MIN = 0.78;

const MAP_NATUREZA: Record<MateriaNatureza, MateriaCorpusId> = {
  Biologia: "biologia",
  Química: "quimica",
  Física: "fisica",
};

export type TriagemNaturezaValidada = {
  catalogoId: MateriaCorpusId | "natureza_transversal" | null;
  triagem: {
    materia: MateriaNatureza | "Transversal" | null;
    confianca: number;
    motivo: string;
  };
  via: "heuristica" | "ia";
};

/** Corrige triagem Natureza após IA — transversal, desempate e heurística forte prevalecem. */
export function validarTriagemNaturezaPosIA(
  texto: string,
  ia: TriagemNatureza,
  heur: TriagemNatureza
): TriagemNaturezaValidada {
  const trans = triarNaturezaTransversal(texto);
  if (trans.catalogoId) {
    return {
      catalogoId: "natureza_transversal",
      triagem: {
        materia: "Transversal",
        confianca: trans.confianca,
        motivo: `pos-ia:${REGRA_NATUREZA_TRANSVERSAL_ID}:${trans.motivo}`,
      },
      via: "heuristica",
    };
  }

  const desempate = desempateTriagemNatureza(texto);
  if (desempate?.materia) {
    return {
      catalogoId: MAP_NATUREZA[desempate.materia],
      triagem: {
        materia: desempate.materia,
        confianca: desempate.confianca,
        motivo: `pos-ia:${desempate.motivo}`,
      },
      via: "heuristica",
    };
  }

  if (heur.materia && heur.confianca >= CONFIANCA_HEURISTICA_NATUREZA_MIN) {
    return {
      catalogoId: MAP_NATUREZA[heur.materia],
      triagem: {
        materia: heur.materia,
        confianca: heur.confianca,
        motivo: heur.motivo,
      },
      via: "heuristica",
    };
  }

  return {
    catalogoId: ia.materia ? MAP_NATUREZA[ia.materia] : null,
    triagem: {
      materia: ia.materia,
      confianca: ia.confianca,
      motivo: ia.motivo,
    },
    via: "ia",
  };
}

/** Exatas: Física prevalece sobre Matemática quando há fenômeno físico claro. */
export function validarExatasPosIA(
  texto: string,
  catalogoId: string
): { catalogoId: string; confianca: number; criterio: string; justificativa: string } {
  if (catalogoId !== "matematica") {
    return {
      catalogoId,
      confianca: 1,
      criterio: "area_bloco",
      justificativa: `Catálogo ${catalogoId} mantido.`,
    };
  }

  const prev = fisicaPrevaleceSobreMatematica(texto);
  if (prev.prevalece) {
    return {
      catalogoId: "fisica",
      confianca: prev.confianca,
      criterio: REGRA_FISICA_PREVALECE_ID,
      justificativa: `Fenômeno físico prevalece: ${prev.motivo}`,
    };
  }

  return {
    catalogoId: "matematica",
    confianca: 1,
    criterio: "area_bloco",
    justificativa: "Área Exatas → catálogo matemática.",
  };
}
