/** Desempate Física × Matemática — regra: fisica_prevalece_quando_ha_grandezas_e_fenomeno */

export const REGRA_FISICA_PREVALECE_ID = "fisica_prevalece_quando_ha_grandezas_e_fenomeno";

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

/** Sinais fortes de fenômeno/grandeza física (não rotear para Matemática só por cálculo). */
const PADROES_FISICA: RegExp[] = [
  /\b(velocidade|aceleracao|forca resultante|forca gravitacional|newton)\b/,
  /\b(energia cinetica|energia potencial|trabalho|joule|potencia eletrica|kwh|kilowatt)\b/,
  /\b(pressao|empuxo|flutuacao|arquimedes|submers)\b/,
  /\b(gas ideal|pv\s*=\s*nrt|termodinamica|dilatacao|calor especifico)\b/,
  /\b(campo eletrico|campo magnetico|forca magnetica|lorentz|inducao)\b/,
  /\b(foton|fotoeletrico|planck|ef\s*=\s*hf|radiacao|frequencia)\b/,
  /\b(espelho plano|reflexao|refracao|optica|lente)\b/,
  /\b(satelite|orbita|gravita|centripet|centripeta)\b/,
  /\b(circuito|corrente eletrica|resistencia|ohm|voltagem|tensao)\b/,
  /\b(mru|mruv|cinematica|dinamica|hidrostatica)\b/,
  /\b(proton|eletron|particula carregada|carga eletrica)\b/,
  /\b(km\/h|m\/s|\bn\b|\bj\b|\bw\b|\bhz\b|\bpa\b|\bt\b|\bo c\b|graus celsius)\b/,
  /\b(tesla|weber|volt|ampere|watt)\b/,
];

/** Linguagem matemática isolada — não prevalece sobre fenômeno físico. */
const PADROES_SO_MATEMATICA: RegExp[] = [
  /\b(porcentagem|proporcao|regra de tres|razao)\b/,
  /\b(grafico|tabela|funcao|equacao|expressao algebraica)\b/,
  /\b(notacao cientifica|potencia de 10)\b/,
  /\b(calcular|manipulacao algebraica)\b/,
];

export type ResultadoFisicaVsMatematica = {
  prevalece: boolean;
  confianca: number;
  motivo: string;
  scoreFisica: number;
  scoreMatematica: number;
};

export function fisicaPrevaleceSobreMatematica(texto: string): ResultadoFisicaVsMatematica {
  const t = norm(texto);
  if (t.length < 20) {
    return {
      prevalece: false,
      confianca: 0,
      motivo: "texto curto",
      scoreFisica: 0,
      scoreMatematica: 0,
    };
  }

  let scoreFisica = 0;
  let scoreMatematica = 0;
  const hitsFis: string[] = [];

  for (const p of PADROES_FISICA) {
    if (p.test(t)) {
      scoreFisica += 1;
      hitsFis.push(p.source.slice(0, 40));
    }
  }
  for (const p of PADROES_SO_MATEMATICA) {
    if (p.test(t)) scoreMatematica += 1;
  }

  const prevalece = scoreFisica >= 1;
  const confianca = prevalece
    ? Math.min(1, 0.55 + scoreFisica * 0.12 - scoreMatematica * 0.05)
    : 0;

  return {
    prevalece,
    confianca,
    motivo: prevalece
      ? `${REGRA_FISICA_PREVALECE_ID}: fenômeno/grandeza física (score=${scoreFisica})`
      : scoreMatematica > 0
        ? "linguagem matemática sem núcleo físico claro"
        : "sem sinal físico forte",
    scoreFisica,
    scoreMatematica,
  };
}

/** Negative hints compartilhados — escopos de Matemática que roubam Física. */
export const NEGATIVE_HINTS_FISICA_EM_MAT = [
  "velocidade média",
  "km/h",
  "força resultante",
  "satélite",
  "satelite",
  "órbita",
  "orbita",
  "força gravitacional",
  "empuxo",
  "volume submerso",
  "dilatação térmica",
  "dilatacao termica",
  "gás ideal",
  "gas ideal",
  "pV=nRT",
  "espelho plano",
  "potência elétrica",
  "potencia eletrica",
  "kWh",
  "campo magnético",
  "campo magnetico",
  "próton",
  "proton",
  "fóton",
  "foton",
  "Planck",
  "efeito fotoelétrico",
  "efeito fotoeletrico",
] as const;
