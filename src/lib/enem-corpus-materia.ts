/** Configuração de matérias do corpus ENEM — Natureza (sub-triagem) vs disciplina única. */

export const MATERIAS_NATUREZA = ["biologia", "quimica", "fisica"] as const;
export const MATERIAS_DISCIPLINA = ["matematica", "humanas", "linguagens"] as const;
export const MATERIAS_CORPUS = [...MATERIAS_NATUREZA, ...MATERIAS_DISCIPLINA] as const;

export type MateriaNaturezaId = (typeof MATERIAS_NATUREZA)[number];
export type MateriaDisciplinaId = (typeof MATERIAS_DISCIPLINA)[number];
export type MateriaCorpusId = (typeof MATERIAS_CORPUS)[number];

export type EnemDisciplinaDb =
  | "ciencias_natureza"
  | "matematica"
  | "ciencias_humanas"
  | "linguagens";

export type MateriaCorpusConfig = {
  materiaId: MateriaCorpusId;
  label: string;
  prefixo: string;
  disciplina: EnemDisciplinaDb;
  /** Natureza: triagem Bio/Quím/Fís. Demais: bloco inteiro = uma matéria. */
  naturezaSub: boolean;
};

export const CORPUS_MATERIA_CONFIG: Record<MateriaCorpusId, MateriaCorpusConfig> = {
  biologia: {
    materiaId: "biologia",
    label: "Biologia",
    prefixo: "bio",
    disciplina: "ciencias_natureza",
    naturezaSub: true,
  },
  quimica: {
    materiaId: "quimica",
    label: "Química",
    prefixo: "quim",
    disciplina: "ciencias_natureza",
    naturezaSub: true,
  },
  fisica: {
    materiaId: "fisica",
    label: "Física",
    prefixo: "fis",
    disciplina: "ciencias_natureza",
    naturezaSub: true,
  },
  matematica: {
    materiaId: "matematica",
    label: "Matemática",
    prefixo: "mat",
    disciplina: "matematica",
    naturezaSub: false,
  },
  humanas: {
    materiaId: "humanas",
    label: "Humanas",
    prefixo: "hum",
    disciplina: "ciencias_humanas",
    naturezaSub: false,
  },
  linguagens: {
    materiaId: "linguagens",
    label: "Linguagens",
    prefixo: "ling",
    disciplina: "linguagens",
    naturezaSub: false,
  },
};

export function configMateriaCorpus(materiaId: string): MateriaCorpusConfig | null {
  return (CORPUS_MATERIA_CONFIG as Record<string, MateriaCorpusConfig>)[materiaId] ?? null;
}

export function parseMateriaCorpusId(raw: string | null): MateriaCorpusId {
  if (raw && raw in CORPUS_MATERIA_CONFIG) return raw as MateriaCorpusId;
  return "biologia";
}

/** Filtro Prisma: questões elegíveis para stats/classificação da matéria. */
export function whereCorpusMateria(materiaId: MateriaCorpusId) {
  const cfg = CORPUS_MATERIA_CONFIG[materiaId];
  if (cfg.naturezaSub) {
    return { disciplina: cfg.disciplina as EnemDisciplinaDb, materia: cfg.label };
  }
  return { disciplina: cfg.disciplina as EnemDisciplinaDb };
}
