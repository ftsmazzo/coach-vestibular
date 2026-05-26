import type { QuestaoExtraida } from "@/lib/ai-extract-prova";
import { taxonomy } from "@/lib/taxonomy";

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function normalizarLabelMateria(raw: string): string {
  const n = norm(raw);
  for (const m of taxonomy.materias) {
    if (norm(m.label) === n || n.includes(norm(m.label)) || norm(m.label).includes(n)) {
      return m.label;
    }
  }
  if (n.includes("lingua portuguesa") || n === "lp") return "Português";
  if (n.includes("english") || n.includes("ingles")) return "Inglês";
  if (n.includes("espanhol") || n.includes("spanish")) return "Espanhol";
  if (n.includes("filosof")) return "Filosofia";
  if (n.includes("sociolog")) return "Sociologia";
  return raw.trim() || "A classificar";
}

export function normalizarLabelAssunto(materiaLabel: string, raw: string): string {
  const mat = taxonomy.materias.find((m) => m.label === materiaLabel);
  if (!mat) return raw.trim() || "A classificar";
  const n = norm(raw);
  for (const t of mat.temas) {
    const tl = norm(t.label);
    if (tl === n || n.includes(tl) || tl.includes(n)) return t.label;
  }
  return raw.trim() || mat.temas[0]?.label || "A classificar";
}

/** Assunto casa com algum tema desta matéria na taxonomia. */
export function assuntoPertenceMateria(materiaLabel: string, assunto: string): boolean {
  const mat = taxonomy.materias.find((m) => m.label === materiaLabel);
  if (!mat) return false;
  const n = norm(assunto);
  return mat.temas.some((t) => {
    const tl = norm(t.label);
    return tl === n || n.includes(tl) || tl.includes(n);
  });
}

/** Em qual matéria o assunto existe (primeira correspondência). */
export function encontrarMateriaDoAssunto(assunto: string): {
  materia: string;
  assunto: string;
} | null {
  const n = norm(assunto);
  if (!n || n === "a classificar") return null;

  for (const m of taxonomy.materias) {
    for (const t of m.temas) {
      const tl = norm(t.label);
      if (tl === n || n.includes(tl) || tl.includes(n)) {
        return { materia: m.label, assunto: t.label };
      }
    }
  }
  return null;
}

const ASSUNTO_ALIASES: Array<{ re: RegExp; materia: string; assunto: string }> = [
  {
    re: /quimica organica|organica|hidrocarboneto|alcool|cetona/i,
    materia: "Química",
    assunto: "Química Orgânica",
  },
  {
    re: /estequiometria|mol\b|massa molar/i,
    materia: "Química",
    assunto: "Estequiometria",
  },
  { re: /matriz|determinante/i, materia: "Matemática", assunto: "Matrizes" },
  {
    re: /geometria espacial|tetraedro|sólido|solido|pyraminx/i,
    materia: "Matemática",
    assunto: "Geometria",
  },
  {
    re: /funcao de variavel|grafico.*cartesian|y\s*=\s*f/i,
    materia: "Matemática",
    assunto: "Funções",
  },
  {
    re: /literatura|entrevista|escrevivencia|conceicao evaristo|poetisa/i,
    materia: "Português",
    assunto: "Literatura",
  },
  {
    re: /gramatica|regencia|crase|sintaxe|morfologia|pontuacao/i,
    materia: "Português",
    assunto: "Gramática",
  },
  {
    re: /hotspot|bioma|endemismo|biodiversidade/i,
    materia: "Biologia",
    assunto: "Ecologia",
  },
  { re: /genetica|dna|rna|hereditariedade/i, materia: "Biologia", assunto: "Genética" },
  { re: /evolucao|darwin|selecao natural/i, materia: "Biologia", assunto: "Evolução" },
  { re: /filosof/i, materia: "Filosofia", assunto: "Filosofia" },
];

function inferirPorAlias(enunciado: string, assuntoAtual: string): {
  materia: string;
  assunto: string;
} | null {
  const blob = norm(`${enunciado} ${assuntoAtual}`);
  for (const { re, materia, assunto } of ASSUNTO_ALIASES) {
    if (re.test(blob)) return { materia, assunto };
  }
  return null;
}

/**
 * Garante par matéria+assunto coerente com a taxonomia.
 * Corrige ex.: Português + Química Orgânica → Química + Química Orgânica.
 */
export function alinharParMateriaAssunto(
  materia: string,
  assunto: string,
  enunciado = ""
): { materia: string; assunto: string; corrigido: boolean } {
  let m = normalizarLabelMateria(materia);
  let a = assunto.trim();

  const porAssunto = encontrarMateriaDoAssunto(a);
  if (porAssunto && porAssunto.materia !== m) {
    return { materia: porAssunto.materia, assunto: porAssunto.assunto, corrigido: true };
  }

  if (porAssunto) {
    return { materia: porAssunto.materia, assunto: porAssunto.assunto, corrigido: false };
  }

  const alias = inferirPorAlias(enunciado, a);
  if (alias && (alias.materia !== m || !assuntoPertenceMateria(m, a))) {
    return { materia: alias.materia, assunto: alias.assunto, corrigido: true };
  }

  if (!assuntoPertenceMateria(m, a)) {
    const aNorm = normalizarLabelAssunto(m, a);
    if (assuntoPertenceMateria(m, aNorm)) {
      return { materia: m, assunto: aNorm, corrigido: aNorm !== a };
    }
    const padrao = taxonomy.materias.find((x) => x.label === m)?.temas[0]?.label;
    if (padrao) {
      return { materia: m, assunto: padrao, corrigido: true };
    }
  } else {
    a = normalizarLabelAssunto(m, a);
  }

  const matExiste = taxonomy.materias.some((x) => x.label === m);
  if (!matExiste) {
    const m2 = normalizarLabelMateria(m);
    if (taxonomy.materias.some((x) => x.label === m2)) {
      return {
        materia: m2,
        assunto: normalizarLabelAssunto(m2, a),
        corrigido: true,
      };
    }
  }

  return { materia: m, assunto: a, corrigido: false };
}

export function alinharQuestaoTaxonomia(q: QuestaoExtraida): QuestaoExtraida {
  const { materia, assunto, corrigido } = alinharParMateriaAssunto(
    q.materia,
    q.assunto,
    q.trechoEnunciado
  );
  if (!corrigido) return { ...q, materia, assunto };
  return {
    ...q,
    materia,
    assunto,
    observacoes:
      q.observacoes ??
      "Par matéria/assunto alinhado à taxonomia (assunto pertencia a outra disciplina).",
  };
}

export function alinharLoteTaxonomia(questoes: QuestaoExtraida[]): {
  questoes: QuestaoExtraida[];
  corrigidas: number;
} {
  let corrigidas = 0;
  const out = questoes.map((q) => {
    const antes = `${q.materia}|${q.assunto}`;
    const n = alinharQuestaoTaxonomia(q);
    if (`${n.materia}|${n.assunto}` !== antes) corrigidas++;
    return n;
  });
  return { questoes: out, corrigidas };
}
