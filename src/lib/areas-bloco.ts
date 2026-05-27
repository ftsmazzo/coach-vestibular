/**
 * Vocabulário interno de áreas/blocos — independente de banca (UFU, ENEM, Unesp…).
 * Gravamos sempre um destes 4 rótulos em ProvaQuestao.areaBloco.
 */

export type AreaBlocoId = "linguagens" | "humanas" | "natureza" | "exatas";

export interface AreaBlocoDef {
  id: AreaBlocoId;
  /** Valor persistido no banco */
  label: string;
  /** Matérias permitidas nesta área */
  materias: readonly string[];
  /** Texto curto para admin / prompts */
  descricao: string;
}

export const AREAS_BLOCO: readonly AreaBlocoDef[] = [
  {
    id: "linguagens",
    label: "Línguas e códigos",
    materias: ["Português", "Literatura", "Inglês", "Espanhol"],
    descricao: "Português, literatura, língua estrangeira, interpretação de textos e códigos",
  },
  {
    id: "humanas",
    label: "Ciências Humanas",
    materias: ["História", "Geografia", "Filosofia", "Sociologia"],
    descricao: "História, geografia, filosofia, sociologia e análise social",
  },
  {
    id: "natureza",
    label: "Ciências Naturais",
    materias: ["Biologia", "Física", "Química"],
    descricao: "Biologia, física, química e fenômenos naturais",
  },
  {
    id: "exatas",
    label: "Exatas",
    materias: ["Matemática"],
    descricao: "Matemática, raciocínio lógico-quantitativo e modelagem",
  },
] as const;

const POR_ID = new Map(AREAS_BLOCO.map((a) => [a.id, a]));
const POR_LABEL = new Map(AREAS_BLOCO.map((a) => [norm(a.label), a]));

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

/** Aliases de cabeçalhos de prova → área canônica */
const ALIAS_PARA_ID: Array<{ test: (n: string) => boolean; id: AreaBlocoId }> = [
  {
    test: (n) =>
      n.includes("linguagem") ||
      n.includes("codigo") ||
      n.includes("literatura") ||
      n.includes("lingua portuguesa") ||
      n.includes("lingua inglesa") ||
      n.includes("lingua espanhola") ||
      n === "ingles" ||
      n === "espanhol" ||
      n === "portugues" ||
      n.includes("interpretacao"),
    id: "linguagens",
  },
  {
    test: (n) =>
      n.includes("humanas") ||
      n === "historia" ||
      n === "geografia" ||
      n === "filosofia" ||
      n === "sociologia",
    id: "humanas",
  },
  {
    test: (n) =>
      n.includes("natureza") ||
      n === "biologia" ||
      n === "fisica" ||
      n === "quimica",
    id: "natureza",
  },
  {
    test: (n) =>
      n.includes("matematica") ||
      n.includes("exatas") ||
      n.includes("logico") ||
      n.includes("quantitat"),
    id: "exatas",
  },
];

export function areaBlocoPorId(id: AreaBlocoId): AreaBlocoDef {
  return POR_ID.get(id)!;
}

export function opcoesAreaBlocoAdmin(): Array<{ value: string; label: string; id: AreaBlocoId }> {
  return AREAS_BLOCO.map((a) => ({
    value: a.label,
    label: `${a.label} — ${a.materias.join(", ")}`,
    id: a.id,
  }));
}

export function labelAreaBlocoCanonica(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const n = norm(raw);
  const exato = POR_LABEL.get(n);
  if (exato) return exato.label;

  for (const alias of ALIAS_PARA_ID) {
    if (alias.test(n)) return areaBlocoPorId(alias.id).label;
  }
  return null;
}

export function areaBlocoIdDeLabel(label: string | null | undefined): AreaBlocoId | null {
  const canon = labelAreaBlocoCanonica(label);
  if (!canon) return null;
  return AREAS_BLOCO.find((a) => a.label === canon)?.id ?? null;
}

export function inferirAreaBlocoPorMateria(materia: string | null | undefined): string | null {
  const m = materia?.trim();
  if (!m || m === "A classificar") return null;
  for (const area of AREAS_BLOCO) {
    if ((area.materias as readonly string[]).includes(m)) return area.label;
  }
  return null;
}

/**
 * Converte texto livre (IA, PDF, CSV) para rótulo interno.
 * Se não reconhecer, tenta inferir pela matéria.
 */
export function normalizarAreaBloco(
  raw: string | null | undefined,
  materia?: string | null
): string | null {
  const canon = labelAreaBlocoCanonica(raw);
  if (canon) return canon;
  if (raw?.trim()) {
    const inferida = inferirAreaBlocoPorMateria(materia);
    if (inferida) return inferida;
  }
  return inferirAreaBlocoPorMateria(materia);
}

export function areaBlocoEhCanonica(label: string | null | undefined): boolean {
  if (!label?.trim()) return true;
  return labelAreaBlocoCanonica(label) === label.trim();
}

export function materiasPermitidasNaArea(label: string | null | undefined): readonly string[] {
  const id = areaBlocoIdDeLabel(label);
  if (!id) return [];
  return areaBlocoPorId(id).materias;
}

export function materiaCompativelComAreaCanonica(
  areaLabel: string | null | undefined,
  materia: string
): boolean {
  const m = materia.trim();
  if (!m || m === "A classificar") return true;

  const canon = labelAreaBlocoCanonica(areaLabel);
  if (!canon) return true;

  const area = AREAS_BLOCO.find((a) => a.label === canon);
  if (!area) return true;
  return (area.materias as readonly string[]).includes(m);
}

/** Lista para prompts de IA — só estes 4 valores em area_bloco */
export function listaAreasBlocoParaPrompt(): string {
  return AREAS_BLOCO.map((a) => `- "${a.label}": ${a.descricao}`).join("\n");
}

/** Few-shots e validação usam os rótulos canônicos */
export const LABELS_AREA_BLOCO = AREAS_BLOCO.map((a) => a.label);
