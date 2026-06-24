/** Disciplinas desmembradas de Humanas e Linguagens (Sprint 1). */

export const DISCIPLINAS_HUMANAS = [
  "historia",
  "geografia",
  "filosofia",
  "sociologia",
] as const;

export const DISCIPLINAS_LINGUAGENS = ["portugues", "ingles", "espanhol"] as const;

export type DisciplinaHumanasId = (typeof DISCIPLINAS_HUMANAS)[number];
export type DisciplinaLinguagensId = (typeof DISCIPLINAS_LINGUAGENS)[number];

export type RotaHumanasId = DisciplinaHumanasId | "indefinido";
export type RotaLinguagensId = DisciplinaLinguagensId | "indefinido";

export const LABEL_DISCIPLINA_SPLIT: Record<
  DisciplinaHumanasId | DisciplinaLinguagensId,
  string
> = {
  historia: "História",
  geografia: "Geografia",
  filosofia: "Filosofia",
  sociologia: "Sociologia",
  portugues: "Português",
  ingles: "Inglês",
  espanhol: "Espanhol",
};

export const PREFIXO_POR_DISCIPLINA: Record<
  DisciplinaHumanasId | DisciplinaLinguagensId,
  string
> = {
  historia: "hist",
  geografia: "geo",
  filosofia: "fil",
  sociologia: "soc",
  portugues: "pt",
  ingles: "ing",
  espanhol: "esp",
};

export const TODAS_DISCIPLINAS_SPLIT = [
  ...DISCIPLINAS_HUMANAS,
  ...DISCIPLINAS_LINGUAGENS,
] as const;

export type CatalogDisciplinaId = (typeof TODAS_DISCIPLINAS_SPLIT)[number];

export function ehCatalogDisciplinaSplit(materiaId: string): materiaId is CatalogDisciplinaId {
  return (TODAS_DISCIPLINAS_SPLIT as readonly string[]).includes(materiaId);
}

export function prefixoValidoParaDisciplina(
  escopoId: string,
  disciplinaId: DisciplinaHumanasId | DisciplinaLinguagensId
): boolean {
  if (escopoId.endsWith(".__nao_classificado")) return true;
  const prefixo = PREFIXO_POR_DISCIPLINA[disciplinaId];
  return escopoId.startsWith(`${prefixo}.`);
}
