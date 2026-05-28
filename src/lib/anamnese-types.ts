/** Etapas da anamnese — entrevista guiada única */
export type AnamneseStageId =
  | "trajetoria"
  | "rotina"
  | "autopercepcao"
  | "comportamento_prova"
  | "metacognicao"
  | "emocional"
  | "sintese";

export const ANAMNESE_STAGES: AnamneseStageId[] = [
  "trajetoria",
  "rotina",
  "autopercepcao",
  "comportamento_prova",
  "metacognicao",
  "emocional",
  "sintese",
];

export const ANAMNESE_STAGE_LABELS: Record<AnamneseStageId, string> = {
  trajetoria: "Sua trajetória",
  rotina: "Rotina de estudo",
  autopercepcao: "Como você se vê",
  comportamento_prova: "Em prova",
  metacognicao: "Seus erros",
  emocional: "Preparação emocional",
  sintese: "Síntese",
};

export type AnamneseMessage = {
  role: "assistant" | "user";
  content: string;
  at?: string;
};

export type AnamneseSession = {
  messages: AnamneseMessage[];
  totalTurns: number;
};

export type StructuredAnamneseProfile = {
  trajectory: {
    currentStage?: "ENSINO_MEDIO" | "CURSINHO" | "AUTODIDATA" | "OUTRO";
    yearsPreparing?: number;
    previousAttempts?: number;
    hasTakenPrepCourse?: boolean;
    targetCourse?: string;
    targetExams?: string[];
    narrativeNotes?: string[];
  };
  routine: {
    studyHoursPerDay?: string;
    consistencyLevel?: "BAIXA" | "MEDIA" | "ALTA";
    mainRoutineObstacle?: string;
    studiesAlone?: boolean;
    hasExternalSupport?: boolean;
  };
  academicSelfPerception: {
    perceivedStrongSubjects?: string[];
    perceivedWeakSubjects?: string[];
    historicalDifficulties?: string[];
    mainDeclaredBlocker?: string;
  };
  examBehavior: {
    fatigueInLongExams?: boolean;
    timeManagementIssue?: boolean;
    anxietyOrBlanking?: boolean;
    changesAnswersByInsecurity?: boolean;
    losesClarityMidExam?: boolean;
  };
  metacognition: {
    understandsMistakesAfterReview?: boolean;
    reviewsMistakesRegularly?: boolean;
    seesPatternsInMistakes?: boolean;
    knowsHowToStudyFromErrors?: boolean;
    metacognitiveMaturity?: "BAIXA" | "MEDIA" | "ALTA";
  };
  emotionalContext: {
    confidenceLevel?: "BAIXA" | "MEDIA" | "ALTA";
    comparisonPressure?: boolean;
    fearOfNotEnoughTime?: boolean;
    mainEmotionalWeight?: string;
    preferredTone?: "ACOLHEDOR" | "DIRETO" | "MOTIVADOR" | "TECNICO_LEVE";
  };
  /** Frases declaradas pelo aluno — para cruzar com provas depois */
  declaredPatterns?: string[];
};

export type AnamnesePublicView = {
  status: "IN_PROGRESS" | "COMPLETED" | "NOT_STARTED";
  currentStage: AnamneseStageId | null;
  stageLabel: string | null;
  progressPct: number;
  summary: string | null;
  messages: AnamneseMessage[];
  canContinue: boolean;
};

export type AnamneseMotorContext = {
  completed: boolean;
  summary: string | null;
  profile: StructuredAnamneseProfile | null;
  /** Uma linha para injetar na narrativa */
  ponteNarrativa: string | null;
  /** Foco inicial quando ainda não há provas */
  focoInicialTitulo: string | null;
  focoInicialDescricao: string | null;
};
