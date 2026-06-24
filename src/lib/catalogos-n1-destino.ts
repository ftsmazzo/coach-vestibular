import {
  DISCIPLINAS_HUMANAS,
  DISCIPLINAS_LINGUAGENS,
  LABEL_DISCIPLINA_SPLIT,
  type CatalogDisciplinaId,
} from "@/lib/conhecimento-catalog/disciplinas-split";
import {
  CLASSIFICACAO_N1_VERSAO,
  versaoLabelN1,
  type ClassificacaoN1,
} from "@/lib/classificacao-n1-types";
import { CORPUS_MATERIA_CONFIG, MATERIAS_NATUREZA } from "@/lib/enem-corpus-materia";

export type OpcaoCatalogoN1 = {
  id: string;
  label: string;
  area: ClassificacaoN1["area"];
  grupo: string;
};

const GRUPO_NATUREZA = "Natureza";
const GRUPO_EXATAS = "Exatas";
const GRUPO_HUMANAS = "Humanas";
const GRUPO_LINGUAGENS = "Linguagens";

/** Catálogos destino válidos para N1 (client-safe). */
export function opcoesCatalogoN1(): OpcaoCatalogoN1[] {
  const out: OpcaoCatalogoN1[] = [];

  for (const id of MATERIAS_NATUREZA) {
    out.push({
      id,
      label: CORPUS_MATERIA_CONFIG[id].label,
      area: "natureza",
      grupo: GRUPO_NATUREZA,
    });
  }

  out.push({
    id: "matematica",
    label: CORPUS_MATERIA_CONFIG.matematica.label,
    area: "exatas",
    grupo: GRUPO_EXATAS,
  });

  for (const id of DISCIPLINAS_HUMANAS) {
    out.push({
      id,
      label: LABEL_DISCIPLINA_SPLIT[id],
      area: "humanas",
      grupo: GRUPO_HUMANAS,
    });
  }

  for (const id of DISCIPLINAS_LINGUAGENS) {
    out.push({
      id,
      label: LABEL_DISCIPLINA_SPLIT[id],
      area: "linguagens",
      grupo: GRUPO_LINGUAGENS,
    });
  }

  return out;
}

export function areaParaCatalogoN1(catalogoId: string): ClassificacaoN1["area"] | null {
  const op = opcoesCatalogoN1().find((o) => o.id === catalogoId);
  return op?.area ?? null;
}

export function labelCatalogoN1(catalogoId: string): string {
  const op = opcoesCatalogoN1().find((o) => o.id === catalogoId);
  return op?.label ?? catalogoId;
}

export function catalogoN1Valido(catalogoId: string): catalogoId is CatalogDisciplinaId | "biologia" | "quimica" | "fisica" | "matematica" {
  return opcoesCatalogoN1().some((o) => o.id === catalogoId);
}

export function montarClassificacaoN1Manual(catalogoId: string): ClassificacaoN1 | null {
  const area = areaParaCatalogoN1(catalogoId);
  if (!area) return null;

  const n1: ClassificacaoN1 = {
    versao: CLASSIFICACAO_N1_VERSAO,
    area,
    catalogoId,
    confianca: 1,
    criterio: "manual",
    justificativa: "Definido manualmente pelo revisor.",
    classificadoEm: new Date().toISOString(),
  };

  if (
    (DISCIPLINAS_HUMANAS as readonly string[]).includes(catalogoId) ||
    (DISCIPLINAS_LINGUAGENS as readonly string[]).includes(catalogoId)
  ) {
    n1.rota = {
      disciplinaId: catalogoId,
      area: (DISCIPLINAS_LINGUAGENS as readonly string[]).includes(catalogoId)
        ? "linguagens"
        : "humanas",
    };
  }

  if ((MATERIAS_NATUREZA as readonly string[]).includes(catalogoId)) {
    n1.triagemNatureza = {
      materia: labelCatalogoN1(catalogoId),
      via: "heuristica",
      motivo: "manual",
    };
  }

  return n1;
}

export { versaoLabelN1 };
