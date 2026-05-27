/** Regras de desambiguação e validação pós-IA (pacote GPT + taxonomia do projeto). */

import {
  materiaCompativelComAreaCanonica,
  normalizarAreaBloco,
} from "@/lib/areas-bloco";

export const MATERIAS_LINGUAGENS = ["Português", "Literatura", "Inglês", "Espanhol"] as const;
export const MATERIAS_HUMANAS = ["História", "Geografia", "Filosofia", "Sociologia"] as const;
export const MATERIAS_NATUREZA = ["Biologia", "Física", "Química"] as const;

const GATILHOS_BIOLOGIA =
  /c[eé]lula|dna|rna|gene|mitose|meiose|ecossistema|cadeia alimentar|fotoss[ií]ntese|homeostase|horm[oô]nio|imunidade|evolu[cç][aã]o|fisiologia|citologia|organismo|hereditariedade|pat[oó]geno/i;

const GATILHOS_GEOGRAFIA =
  /mapa|escala|latitude|longitude|clima|relevo|cartograf|urbaniza[cç][aã]o|geopol[ií]tica|hidrografia|vegeta[cç][aã]o|metropoliza[cç][aã]o|coordenada/i;

const GATILHOS_FISICA =
  /cinem[aá]tica|velocidade|acelera[cç][aã]o|for[cç]a|newton|joule|ohm|circuito|corrente|tens[aã]o|optica|lente|refra[cç][aã]o|ondas|energia mec[aâ]nica/i;

export function temGatilhoBiologico(texto: string): boolean {
  return GATILHOS_BIOLOGIA.test(texto);
}

export function temGatilhoGeografico(texto: string): boolean {
  return GATILHOS_GEOGRAFIA.test(texto);
}

export function materiaCompativelComBloco(areaBloco: string, materia: string): boolean {
  const canon = normalizarAreaBloco(areaBloco, materia) ?? areaBloco;
  return materiaCompativelComAreaCanonica(canon, materia);
}

export type ItemClassificado = {
  numero: number;
  areaBloco?: string;
  materia: string;
  assunto: string;
  conhecimento?: string;
  resumoEnunciado?: string;
};

export function validarItemClassificado(
  item: ItemClassificado
): { ok: boolean; motivo?: string } {
  const area = item.areaBloco?.trim() ?? "";
  const mat = item.materia.trim();
  const assunto = item.assunto.trim();
  const blob = `${item.resumoEnunciado ?? ""} ${item.conhecimento ?? ""} ${assunto}`;

  if (!mat || mat === "A classificar") {
    return { ok: true };
  }

  if (area && !materiaCompativelComBloco(area, mat)) {
    return {
      ok: false,
      motivo: `Matéria «${mat}» incompatível com bloco «${area.slice(0, 60)}»`,
    };
  }

  if (
    /interpreta[cç][aã]o de texto/i.test(assunto) &&
    !(MATERIAS_LINGUAGENS as readonly string[]).includes(mat)
  ) {
    return {
      ok: false,
      motivo: "Assunto Interpretação de Texto exige Português ou Literatura",
    };
  }

  if (mat === "Biologia" && temGatilhoGeografico(blob) && !temGatilhoBiologico(blob)) {
    return { ok: false, motivo: "Biologia sem gatilho biológico (parece Geografia)" };
  }

  if (mat === "Biologia" && GATILHOS_FISICA.test(blob) && !temGatilhoBiologico(blob)) {
    return { ok: false, motivo: "Biologia sem gatilho biológico (parece Física)" };
  }

  if (mat === "Biologia" && area && normalizarAreaBloco(area, mat) === "Ciências Humanas") {
    return { ok: false, motivo: "Biologia em bloco de Ciências Humanas" };
  }

  if (mat === "Biologia" && normalizarAreaBloco(area, mat) === "Línguas e códigos") {
    return { ok: false, motivo: "Biologia em bloco de Línguas e códigos" };
  }

  if (
    mat === "Biologia" &&
    !temGatilhoBiologico(blob) &&
    (normalizarAreaBloco(area, mat) === "Ciências Humanas" ||
      normalizarAreaBloco(area, mat) === "Línguas e códigos")
  ) {
    return {
      ok: false,
      motivo: "Biologia sem gatilho biológico em bloco Humanas/Linguagens",
    };
  }

  if (
    mat === "Geografia" &&
    normalizarAreaBloco(area, mat) === "Línguas e códigos" &&
    !temGatilhoGeografico(blob)
  ) {
    return {
      ok: false,
      motivo: "Geografia em Linguagens sem gatilho cartográfico/espacial",
    };
  }

  return { ok: true };
}

/** Texto extra para o system prompt (regras de ouro). */
export const REGRAS_OURO_CLASSIFICACAO = `
Regras de ouro:
- sociedade não implica Sociologia automaticamente; pode ser Filosofia, História ou Geografia.
- população não implica Biologia; em vestibular costuma ser Geografia ou Sociologia.
- meio ambiente não implica Biologia; pode ser Geografia se o foco for território/uso do solo.
- território/região/paisagem em crônica, charge ou artigo interpretativo pode ser Português.
- saúde pública sem fisiologia, patógeno ou sistema corporal não é Biologia.
- area_bloco tem prioridade 1; resumo_enunciado e conteúdo têm prioridade 2.
- Nunca chute Biologia. Se incerto, materia vazia ou "A classificar".
`.trim();

export const FEW_SHOTS_CLASSIFICACAO = [
  {
    numero: 1,
    area_bloco: "Línguas e códigos",
    materia: "Português",
    assunto: "Interpretação de Texto",
    conhecimento: "Inferir o sentido de um argumento em texto jornalístico.",
    resumo_enunciado: "Texto jornalístico pede inferência sobre argumento do autor.",
  },
  {
    numero: 9,
    area_bloco: "Línguas e códigos",
    materia: "Português",
    assunto: "Interpretação de Texto",
    conhecimento: "Interpretar efeitos de sentido em crônica sobre território e pertencimento.",
    resumo_enunciado: "Crônica literária sobre território — tarefa é interpretação, não mapa.",
  },
  {
    numero: 5,
    area_bloco: "Ciências Humanas",
    materia: "Filosofia",
    assunto: "Ética",
    conhecimento: "Aplicar conceito filosófico de justiça a uma situação social.",
    resumo_enunciado: "Questão sobre justiça e conceito filosófico, não demografia.",
  },
  {
    numero: 6,
    area_bloco: "Ciências Humanas",
    materia: "Sociologia",
    assunto: "Sociedade e cultura",
    conhecimento: "Analisar desigualdade de acesso a direitos em contexto social.",
    resumo_enunciado: "Cidadania e desigualdade social — Sociologia, não Biologia.",
  },
  {
    numero: 7,
    area_bloco: "Ciências Naturais",
    materia: "Biologia",
    assunto: "Ecologia",
    conhecimento: "Interpretar relações tróficas e fluxo de energia em ecossistema.",
    resumo_enunciado: "Cadeia alimentar e fluxo de energia em ecossistema.",
  },
] as const;

export function areaBlocoPorNumero(
  blocos: Array<{ titulo: string; questao_inicio: number; questao_fim: number }>,
  numero: number
): string {
  for (const b of blocos) {
    if (numero >= b.questao_inicio && numero <= b.questao_fim) {
      return normalizarAreaBloco(b.titulo) ?? b.titulo;
    }
  }
  return "";
}
