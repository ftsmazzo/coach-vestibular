/** Resposta paginada de GET /v1/exams/{year}/questions */
export type EnemDevQuestionsPage = {
  metadata: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
  questions: EnemDevQuestion[];
};

export type EnemDevQuestion = {
  title: string;
  index: number;
  discipline: EnemDevDiscipline;
  language: EnemDevLanguage | null;
  year: number;
  context: string | null;
  files: string[];
  correctAlternative: string;
  alternativesIntroduction: string | null;
  alternatives: EnemDevAlternative[];
};

export type EnemDevAlternative = {
  letter: string;
  text: string;
  file: string | null;
  isCorrect: boolean;
};

export type EnemDevDiscipline =
  | "linguagens"
  | "ciencias-humanas"
  | "ciencias-natureza"
  | "matematica";

export type EnemDevLanguage = "ingles" | "espanhol";

export type EnemDevExam = {
  title: string;
  year: number;
  disciplines: { label: string; value: EnemDevDiscipline }[];
  languages: { label: string; value: EnemDevLanguage }[];
};
