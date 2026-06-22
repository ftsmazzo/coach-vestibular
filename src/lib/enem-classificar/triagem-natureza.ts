/** Triagem Biologia / Química / Física dentro do bloco Ciências da Natureza do ENEM. */

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
      /\b(onda|frequencia|som|luz|optica|lente|espelho|reflexao|refracao)\b/,
      /\b(termodinamica|calor|temperatura|energia cinetica|energia potencial)\b/,
      /\b(raios?\s*cos|sievert|radiacao ionizante|dosimetria|radioatividad)\b/,
      /\b(esfera vertical|fogao por inducao|discos opticos)\b/,
      /\b(gravitacao|pressao|empuxo)\b/,
    ],
  },
  {
    id: "Química",
    patterns: [
      /\b(molecula|atomo|ion|eletron|proton|neutron|tabela periodica)\b/,
      /\b(reacao quimica|reagente|produto|estequiometria|mol\b|molar)\b/,
      /\b(acido|base|ph\b|neutralizacao|oxidacao|reducao)\b/,
      /\b(solucao|solubilidade|concentracao|molaridade|diluicao)\b/,
      /\b(organica|cetona|alcool|hidrocarboneto)\b/,
      /\b(ligacao quimica|covalente|ionica|metalica)\b/,
      /\b(nitrato|mercurio|enferrujado|vidro.*aluminio)\b/,
      /\bquimic/,
    ],
  },
  {
    id: "Biologia",
    patterns: [
      /\b(celula|citologia|membrana|organela|mitocondria|cloroplasto)\b/,
      /\b(dna|rna|gene|genetica|cromossomo|heranca|mutacao)\b/,
      /\b(ecologia|ecossistema|bioma|cadeia alimentar|trofic|decompositor)\b/,
      /\b(evolucao|darwin|selecao natural|especiacao|fossil)\b/,
      /\b(virus|bacteria|protozo|fungo|parasita|doenca|vacina|imunidade)\b/,
      /\b(fotossintese|respiracao celular|metabolismo|enzima)\b/,
      /\b(hormonio|menstruacao|fertilizacao|embriao|gestacao|sistema nervoso)\b/,
      /\b(planta|animal|ser vivo|organismo|tecido|orgao)\b/,
      /\b(abelha|colmeia|ave|muscular|sangue|coracao|figado)\b/,
      /\b(leishmaniose|zoonose|epidemi|saude publica)\b/,
      /\b(pcr\b|teste genetico|covid|coronavirus|ebola|dengue|chagas|trypanosoma|malária|malaria)\b/,
      /\b(biorremedia|fertilizacao in vitro|espermatoz|gameta|anfibio|anuro)\b/,
      /\b(reflexo patelar|reflexo patel|termogenina|vacuolo|antimicrobiano|biotecnolog)\b/,
      /\b(aedes|wolbachia|picad.*serpente|veneno.*cascavel)\b/,
    ],
  },
];

const BIO_DESEMPATE =
  /\b(leishmania|chagas|trypanosoma|protozo|parasita|zoonose|virus|bacteria|vacina|celula|dna|ecologia|fotossintese|evolucao|anfibio|embriao|fertilizacao|biorremedia)\b/;

export function triarMateriaNatureza(enunciado: string): TriagemNatureza {
  const texto = norm(enunciado);
  if (texto.length < 15) {
    return { materia: null, confianca: 0, motivo: "texto curto" };
  }

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

  const ranked = (Object.entries(scores) as [MateriaNatureza, number][])
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1]);

  if (ranked.length === 0) {
    return { materia: null, confianca: 0, motivo: "sem sinal de matéria" };
  }

  const [top, scoreTop] = ranked[0]!;
  const scoreSegundo = ranked[1]?.[1] ?? 0;

  if (scoreTop === scoreSegundo && scoreSegundo > 0) {
    if (BIO_DESEMPATE.test(texto)) {
      return { materia: "Biologia", confianca: 0.45, motivo: "desempate bio" };
    }
    return {
      materia: null,
      confianca: 0.2,
      motivo: `empate ${ranked[0]![0]}/${ranked[1]![0]}`,
    };
  }

  const confianca = Math.min(1, scoreTop / (scoreTop + scoreSegundo + 1));

  if (confianca < 0.35 && scoreTop < 2) {
    return { materia: null, confianca, motivo: "confiança baixa na triagem" };
  }

  return {
    materia: top,
    confianca,
    motivo: `score ${top}=${scoreTop}`,
  };
}
