/** Heurísticas determinísticas de roteamento N1 (antes/depois da IA). */

export type DisciplinaLinguagensHeuristica = "portugues" | "ingles" | "espanhol";
export type DisciplinaHumanasHeuristica = "historia" | "geografia" | "filosofia" | "sociologia";

export type ResultadoHeuristicaRoteamento<T extends string> = {
  disciplinaId: T;
  confianca: number;
  motivo: string;
};

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

const PADROES_INGLES: RegExp[] = [
  /\bequivale,?\s+em\s+portugues\b/,
  /\bequivale\s+em\s+portugues\b/,
  /\bno\s+contexto\s+da\s+tira\b/,
  /\bno\s+contexto\s+da\s+tirinha\b/,
  /\b(a\s+)?fala\b.*\b(em\s+)?ingles\b/,
  /\bexpressao\s+em\s+ingles\b/,
  /\bexpressão\s+em\s+inglês\b/,
  /\bthat'?ll\s+be\s+the\s+day\b/,
  /\bdon'?t\s+try\b/,
  /\bwho\s+needs\s+your\s+answers\b/,
  /\bi'?ll\s+bet\b/,
  /\bmaybe\s+you'?d\s+like\b/,
  /\bwager\b/,
  /\bmr\.?\s+bigmouth\b/,
  /\bargumento\s+invalidado\b/,
  /\btrecho\s+da\s+tira\b/,
  /\baccording\s+to\s+the\s+text\b/,
  /\bmain\s+idea\b/,
  /\bmeaning\s+of\s+the\s+(word|expression)\b/,
];

const PADROES_ESPANHOL: RegExp[] = [
  /\bsegun\s+el\s+texto\b/,
  /\bidea\s+principal\b/,
  /\bpretérito\s+perfecto\b/,
  /\bsubjuntivo\b/,
  /\bexpresion\s+en\s+espanol\b/,
];

const PADROES_SOCIOLOGIA: RegExp[] = [
  /\bsociedade\s+contemporanea\b/,
  /\bexclusao\s+social\b/,
  /\bprodutivismo\b/,
  /\benvelhecimento\b/,
  /\bvelhice\b/,
  /\bcapacidade\s+produtiva\b/,
  /\bvalor\s+economico\b/,
  /\baceleracao\s+do\s+cotidiano\b/,
  /\baceleracao\s+social\b/,
  /\bcompreensao\s+critica\s+sobre\s+a\s+sociedade\b/,
  /\bresistencia\s+a\s+logica\s+social\b/,
  /\bdesaceleracao\b/,
  /\bsimone\s+de\s+beauvoir\b/,
];

const PADROES_GEOGRAFIA_AMBIENTAL: RegExp[] = [
  /\beutrofizacao\b/,
  /\besgoto\s+in\s+natura\b/,
  /\btratamento\s+de\s+esgoto\b/,
  /\bsaneamento\s+ambiental\b/,
  /\bqualidade\s+da\s+agua\b/,
  /\brecursos\s+hidricos\b/,
  /\bpoluicao\s+hidrica\b/,
  /\bproliferacao\s+de\s+algas\b/,
];

function pontuarPadroes(texto: string, padroes: RegExp[]): number {
  let score = 0;
  for (const p of padroes) {
    if (p.test(texto)) score += 1;
  }
  return score;
}

/** Comando em PT cobrando trecho/fala/expressão em inglês → Inglês. */
export function heuristicaLinguagensDisciplina(
  texto: string
): ResultadoHeuristicaRoteamento<DisciplinaLinguagensHeuristica> | null {
  const t = norm(texto);
  if (t.length < 20) return null;

  const en = pontuarPadroes(t, PADROES_INGLES);
  const es = pontuarPadroes(t, PADROES_ESPANHOL);

  if (en >= 1 && en > es) {
    return {
      disciplinaId: "ingles",
      confianca: Math.min(0.95, 0.7 + en * 0.08),
      motivo: `sinais de competência em inglês (score=${en})`,
    };
  }
  if (es >= 2 && es > en) {
    return {
      disciplinaId: "espanhol",
      confianca: Math.min(0.9, 0.65 + es * 0.08),
      motivo: `sinais de competência em espanhol (score=${es})`,
    };
  }
  return null;
}

/** Fenômeno social ou impacto ambiental territorial — não rotear por formato do texto. */
export function heuristicaHumanasDisciplina(
  texto: string
): ResultadoHeuristicaRoteamento<DisciplinaHumanasHeuristica> | null {
  const t = norm(texto);
  if (t.length < 25) return null;

  const soc = pontuarPadroes(t, PADROES_SOCIOLOGIA);
  const geo = pontuarPadroes(t, PADROES_GEOGRAFIA_AMBIENTAL);

  if (soc >= 1 && soc >= geo) {
    return {
      disciplinaId: "sociologia",
      confianca: Math.min(0.92, 0.68 + soc * 0.1),
      motivo: `fenômeno social cobrado (score=${soc})`,
    };
  }
  if (geo >= 1) {
    return {
      disciplinaId: "geografia",
      confianca: Math.min(0.92, 0.68 + geo * 0.1),
      motivo: `impacto ambiental/territorial hídrico (score=${geo})`,
    };
  }
  return null;
}

type RotaMinima = {
  disciplinaId: string;
  criterio: string;
  confianca: number;
  justificativa: string;
  sinalizadorRevisao: boolean;
};

/** Metadado de variante + heurística de conteúdo. Nunca força português em rota indefinida. */
export function aplicarRoteamentoDeterministicoLinguagens(
  texto: string,
  idiomaVariante: string | null | undefined,
  rota: RotaMinima
): RotaMinima {
  if (idiomaVariante === "INGLES" || idiomaVariante === "ingles") {
    if (rota.disciplinaId === "ingles") return rota;
    return {
      disciplinaId: "ingles",
      criterio: "metadata",
      confianca: Math.max(rota.confianca, 0.95),
      justificativa: `Variante INGLES; IA sugeriu ${rota.disciplinaId}.`,
      sinalizadorRevisao: true,
    };
  }
  if (idiomaVariante === "ESPANHOL" || idiomaVariante === "espanhol") {
    if (rota.disciplinaId === "espanhol") return rota;
    return {
      disciplinaId: "espanhol",
      criterio: "metadata",
      confianca: Math.max(rota.confianca, 0.95),
      justificativa: `Variante ESPANHOL; IA sugeriu ${rota.disciplinaId}.`,
      sinalizadorRevisao: true,
    };
  }

  const heur = heuristicaLinguagensDisciplina(texto);
  if (heur) {
    if (rota.disciplinaId === heur.disciplinaId) return rota;
    return {
      disciplinaId: heur.disciplinaId,
      criterio: "heuristica",
      confianca: Math.max(rota.confianca, heur.confianca),
      justificativa: `${heur.motivo}; IA sugeriu ${rota.disciplinaId}.`,
      sinalizadorRevisao:
        rota.disciplinaId !== "indefinido" && rota.disciplinaId !== heur.disciplinaId,
    };
  }

  return rota;
}

export function aplicarRoteamentoDeterministicoHumanas(
  texto: string,
  rota: RotaMinima
): RotaMinima {
  const heur = heuristicaHumanasDisciplina(texto);
  if (!heur) return rota;
  if (rota.disciplinaId === heur.disciplinaId) return rota;
  return {
    disciplinaId: heur.disciplinaId,
    criterio: "heuristica",
    confianca: Math.max(rota.confianca, heur.confianca),
    justificativa: `${heur.motivo}; IA sugeriu ${rota.disciplinaId}.`,
    sinalizadorRevisao:
      rota.disciplinaId !== "indefinido" && rota.disciplinaId !== heur.disciplinaId,
  };
}
