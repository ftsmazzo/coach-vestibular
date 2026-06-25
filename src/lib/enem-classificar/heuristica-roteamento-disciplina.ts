/** Heurísticas determinísticas de roteamento N1 — aplicadas antes e depois da IA. */

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

/** Sinais inequívocos de competência em inglês (bastam sozinhos). */
const PADROES_INGLES_FORTES: RegExp[] = [
  /\bequivale,?\s+em\s+portugues\b/,
  /\bthat'?ll\s+be\s+the\s+day\b/,
  /\baccording\s+to\s+the\s+text\b/,
  /\bmain\s+idea\b/,
  /\bmeaning\s+of\s+the\s+(word|expression)\b/,
  /\bdon'?t\s+try\b/,
  /\bwho\s+needs\s+your\s+answers\b/,
  /\bi'?ll\s+bet\b/,
  /\bmaybe\s+you'?d\s+like\b/,
  /\bwager\b/,
  /\bmr\.?\s+bigmouth\b/,
  /\bexpressao\s+em\s+ingles\b/,
  /\bfala\b[^.]{0,80}\b(that|don't|who|i'll|maybe|wager)\b/,
];

/** Só contam junto com trecho claramente em inglês no texto-base/enunciado. */
const PADROES_INGLES_COM_CONTEXTO: RegExp[] = [
  /\bno\s+contexto\s+da\s+tira\b/,
  /\bno\s+contexto\s+da\s+tirinha\b/,
  /\bo\s+trecho\s+da\s+tira\b/,
  /\ba\s+fala\b/,
  /\bargumento\s+invalidado\b/,
  /\bequivalen(te|cia)\b/,
  /\bsentido\s+(da\s+)?express/,
];

const PADROES_TEXTO_EM_INGLES: RegExp[] = [
  /\b(that'll|thatll|don't|dont|i'll|ill|who needs|your answers|maybe you'd)\b/,
  /\b(the day|bigmouth|wager)\b/,
  /['’][a-z]{1,4}\b/,
  /\b(the|and|you|your|who|needs|answers|bet|maybe|day)\b(?:\s+\w+){0,3}\b/,
];

const PADROES_ESPANHOL_FORTES: RegExp[] = [
  /\bsegun\s+el\s+texto\b/,
  /\bidea\s+principal\b/,
  /\bpreterito\s+perfecto\b/,
  /\bsubjuntivo\b/,
  /\bexpresion\s+en\s+espanol\b/,
];

const PADROES_SOCIOLOGIA: RegExp[] = [
  /\bsociedade\s+contemporanea\b/,
  /\bexclusao\s+social\b/,
  /\bprodutivismo\b/,
  /\benvelhecimento\b/,
  /\bvelhice\b/,
  /\ba\s+velhice\b/,
  /\bcapacidade\s+produtiva\b/,
  /\bvalor\s+economico\b/,
  /\baceleracao\s+do\s+cotidiano\b/,
  /\baceleracao\s+social\b/,
  /\bcompreensao\s+critica\s+sobre\s+a\s+sociedade\b/,
  /\bresistencia\s+a\s+logica\s+social\b/,
  /\bdesaceleracao\b/,
  /\bsimone\s+de\s+beauvoir\b/,
  /\bvida\s+social\b/,
  /\bidosos?\b/,
  /\bpaciencia\b/,
  /\blenine\b/,
  /\btrabalho\b.*\b(produtiv|economico|valor)\b/,
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
  /\bexcesso\s+de\s+nutrientes\b/,
  /\blancamento\s+de\s+materia\s+organica\b/,
];

function pontuarPadroes(texto: string, padroes: RegExp[]): number {
  let score = 0;
  for (const p of padroes) {
    if (p.test(texto)) score += 1;
  }
  return score;
}

function temTrechoEmIngles(texto: string): boolean {
  return pontuarPadroes(texto, PADROES_TEXTO_EM_INGLES) >= 1;
}

/** Comando em PT cobrando trecho/fala/expressão em inglês → Inglês. */
export function heuristicaLinguagensDisciplina(
  texto: string
): ResultadoHeuristicaRoteamento<DisciplinaLinguagensHeuristica> | null {
  const t = norm(texto);
  if (t.length < 20) return null;

  const fortes = pontuarPadroes(t, PADROES_INGLES_FORTES);
  const contexto = pontuarPadroes(t, PADROES_INGLES_COM_CONTEXTO);
  const es = pontuarPadroes(t, PADROES_ESPANHOL_FORTES);
  const inglesNoTexto = temTrechoEmIngles(t);

  if (fortes >= 1 && fortes >= es) {
    return {
      disciplinaId: "ingles",
      confianca: Math.min(0.96, 0.82 + fortes * 0.05),
      motivo: `competência em inglês — sinais fortes (${fortes})`,
    };
  }

  if (contexto >= 1 && inglesNoTexto && es === 0) {
    return {
      disciplinaId: "ingles",
      confianca: Math.min(0.9, 0.75 + contexto * 0.06),
      motivo: "comando em PT sobre fala/trecho em inglês na tira/texto",
    };
  }

  if (es >= 2 && es > fortes) {
    return {
      disciplinaId: "espanhol",
      confianca: Math.min(0.9, 0.68 + es * 0.08),
      motivo: `competência em espanhol (score=${es})`,
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
      confianca: Math.min(0.93, 0.72 + soc * 0.08),
      motivo: `fenômeno social cobrado (score=${soc})`,
    };
  }
  if (geo >= 1) {
    return {
      disciplinaId: "geografia",
      confianca: Math.min(0.93, 0.72 + geo * 0.08),
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

function rotaDeHeuristica<T extends string>(
  heur: ResultadoHeuristicaRoteamento<T>,
  ia?: RotaMinima
): RotaMinima {
  return {
    disciplinaId: heur.disciplinaId,
    criterio: "heuristica",
    confianca: heur.confianca,
    justificativa: ia
      ? `${heur.motivo}; IA sugeriu ${ia.disciplinaId}.`
      : heur.motivo,
    sinalizadorRevisao: Boolean(ia && ia.disciplinaId !== heur.disciplinaId && ia.disciplinaId !== "indefinido"),
  };
}

/** Tenta roteamento só por heurística (pula IA quando confiança alta). */
export function roteamentoLinguagensPorHeuristica(
  texto: string,
  idiomaVariante: string | null | undefined
): RotaMinima | null {
  if (idiomaVariante === "INGLES" || idiomaVariante === "ingles") {
    return {
      disciplinaId: "ingles",
      criterio: "metadata",
      confianca: 0.97,
      justificativa: "Variante INGLES no metadado da questão.",
      sinalizadorRevisao: false,
    };
  }
  if (idiomaVariante === "ESPANHOL" || idiomaVariante === "espanhol") {
    return {
      disciplinaId: "espanhol",
      criterio: "metadata",
      confianca: 0.97,
      justificativa: "Variante ESPANHOL no metadado da questão.",
      sinalizadorRevisao: false,
    };
  }
  const heur = heuristicaLinguagensDisciplina(texto);
  if (heur && heur.confianca >= 0.78) {
    return rotaDeHeuristica(heur);
  }
  return null;
}

export function roteamentoHumanasPorHeuristica(texto: string): RotaMinima | null {
  const heur = heuristicaHumanasDisciplina(texto);
  if (heur && heur.confianca >= 0.75) {
    return rotaDeHeuristica(heur);
  }
  return null;
}

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
    return rotaDeHeuristica(heur, rota);
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
  return rotaDeHeuristica(heur, rota);
}
