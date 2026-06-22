/** Triagem Biologia / Química / Física — v2: vence o maior score (≥1). */

export type MateriaNatureza = "Biologia" | "Química" | "Física";

export type TriagemNatureza = {
  materia: MateriaNatureza | null;
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

type Regra = { id: MateriaNatureza; patterns: RegExp[] };

const REGRAS: Regra[] = [
  {
    id: "Física",
    patterns: [
      /\b(forca|newton|velocidade|aceleracao|lancamento|queda livre|movimento)\b/,
      /\b(circuito|corrente eletrica|resistencia|ohm|voltagem|tensao|potencia eletrica)\b/,
      /\b(inducao|eletromagnet|campo magnetico|transformador|joule)\b/,
      /\b(onda|frequencia|optica|lente|espelho|reflexao|refracao)\b/,
      /\b(termodinamica|energia cinetica|energia potencial)\b/,
      /\b(raios?\s*cos|sievert|radiacao ionizante|dosimetria|radioatividad)\b/,
      /\b(esfera vertical|fogao por inducao|discos opticos|laser)\b/,
      /\b(gravitacao|pressao|empuxo)\b/,
    ],
  },
  {
    id: "Química",
    patterns: [
      /\b(molecula|atomo|ion|eletron|proton|neutron|tabela periodica)\b/,
      /\b(reacao quimica|reagente|estequiometria|mol\b|molar)\b/,
      /\b(acido|base|ph\b|neutralizacao|oxidacao|reducao)\b/,
      /\b(solucao|solubilidade|concentracao|molaridade)\b/,
      /\b(organica|cetona|alcool|hidrocarboneto)\b/,
      /\b(ligacao quimica|covalente|ionica)\b/,
      /\b(nitrato|mercurio|enferrujado)\b/,
      /\bquimic/,
      /\b(2,4-dinitrofenol|dnp\b)/,
    ],
  },
  {
    id: "Biologia",
    patterns: [
      /\b(celula|citologia|membrana|organela|mitocondria|cloroplasto|lisossom)\b/,
      /\b(dna|rna|gene|genetica|cromossomo|heranca|mutacao|trissomia|sindrome de down)\b/,
      /\b(ecologia|ecossistema|bioma|cadeia alimentar|trofic|decompositor|deserto)\b/,
      /\b(evolucao|darwin|selecao natural|especiacao|fossil|carbono 14|datacao)\b/,
      /\b(virus|bacteria|protozo|fungo|parasita|doenca|vacina|imunidade|retrovirus)\b/,
      /\b(fotossintese|respiracao celular|metabolismo|enzima|termogenina)\b/,
      /\b(hormonio|menstruacao|fertilizacao|embriao|gestacao|sistema nervoso)\b/,
      /\b(planta|animal|ser vivo|organismo|tecido|orgao|anfibio|anuro)\b/,
      /\b(abelha|colmeia|ave|muscular|sangue|coracao|figado|eletrocardiograma)\b/,
      /\b(leishmaniose|zoonose|chagas|trypanosoma|malária|malaria|dengue|ebola|covid)\b/,
      /\b(pcr\b|teste genetico|biorremedia|espermatoz|gameta)\b/,
      /\b(reflexo patelar|antimicrobiano|aedes|wolbachia|estaquia|propagacao)\b/,
      /\b(preguica|pantanal|coffea|arabica|hibrid|cruzamento.*planta)\b/,
      /\b(veneno.*cascavel|serpente|picad)\b/,
    ],
  },
];

function pontuar(texto: string): Record<MateriaNatureza, number> {
  const scores: Record<MateriaNatureza, number> = {
    Biologia: 0,
    Química: 0,
    Física: 0,
  };
  for (const regra of REGRAS) {
    for (const p of regra.patterns) {
      if (p.test(texto)) scores[regra.id] += 1;
    }
  }
  return scores;
}

export function triarMateriaNatureza(enunciado: string): TriagemNatureza {
  const texto = norm(enunciado);
  if (texto.length < 15) {
    return { materia: null, confianca: 0, motivo: "texto curto" };
  }

  const scores = pontuar(texto);
  const ranked = (Object.entries(scores) as [MateriaNatureza, number][])
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1]);

  if (ranked.length === 0) {
    return { materia: null, confianca: 0, motivo: "sem sinal de matéria" };
  }

  const [top, scoreTop] = ranked[0]!;
  const scoreSegundo = ranked[1]?.[1] ?? 0;

  if (scoreTop === scoreSegundo) {
    return { materia: null, confianca: 0.25, motivo: `empate ${ranked[0]![0]}/${ranked[1]![0]}` };
  }

  const confianca = scoreTop / (scoreTop + scoreSegundo + 0.5);
  return {
    materia: top,
    confianca: Math.min(1, confianca),
    motivo: `${top}=${scoreTop} vs ${scoreSegundo}`,
  };
}
