import type { EnemDevDiscipline, EnemDevLanguage, EnemDevQuestion } from "./types";

/** Dia do ENEM inferido pelo número global (1–90 / 91–180). */
export function inferirDiaEnem(numero: number): 1 | 2 {
  return numero <= 90 ? 1 : 2;
}

/** Área Coach derivada da disciplina ENEM — apenas metadado estrutural. */
export function areaBlocoDeDisciplina(discipline: EnemDevDiscipline): string {
  const map: Record<EnemDevDiscipline, string> = {
    linguagens: "Linguagens",
    "ciencias-humanas": "Humanas",
    "ciencias-natureza": "Natureza",
    matematica: "Matemática",
  };
  return map[discipline];
}

/** Converte hífen da API para enum Prisma (ciencias-humanas → ciencias_humanas). */
export function disciplinaParaEnum(
  discipline: EnemDevDiscipline
): "linguagens" | "ciencias_humanas" | "ciencias_natureza" | "matematica" {
  return discipline.replace(/-/g, "_") as ReturnType<typeof disciplinaParaEnum>;
}

export function idiomaParaEnum(
  language: EnemDevLanguage | null
): "COMUM" | "ingles" | "espanhol" {
  if (!language) return "COMUM";
  return language;
}

export function montarFonteId(
  ano: number,
  numero: number,
  idioma: "COMUM" | "ingles" | "espanhol"
): string {
  return `${ano}:${numero}:${idioma}`;
}

export type EnemCorpusEstrutural = {
  ano: number;
  numero: number;
  idioma: "COMUM" | "ingles" | "espanhol";
  dia: number;
  disciplina: ReturnType<typeof disciplinaParaEnum>;
  titulo: string | null;
  enunciadoMd: string | null;
  introducaoAlternativas: string | null;
  alternativas: EnemDevQuestion["alternatives"];
  gabarito: string;
  arquivos: string[] | null;
  areaBloco: string;
  fonteId: string;
};

/** Extrai somente campos estruturais da questão — sem matéria/assunto/N1/N2. */
export function mapearQuestaoEstrutural(q: EnemDevQuestion): EnemCorpusEstrutural {
  const idioma = idiomaParaEnum(q.language);
  return {
    ano: q.year,
    numero: q.index,
    idioma,
    dia: inferirDiaEnem(q.index),
    disciplina: disciplinaParaEnum(q.discipline),
    titulo: q.title ?? null,
    enunciadoMd: q.context ?? null,
    introducaoAlternativas: q.alternativesIntroduction ?? null,
    alternativas: q.alternatives,
    gabarito: q.correctAlternative,
    arquivos: q.files?.length ? q.files : null,
    areaBloco: areaBlocoDeDisciplina(q.discipline),
    fonteId: montarFonteId(q.year, q.index, idioma),
  };
}
