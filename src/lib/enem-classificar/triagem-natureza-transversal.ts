/** Triagem para catálogo Natureza Transversal (metodologia científica, natureza da ciência). */

export type TriagemNaturezaTransversal = {
  catalogoId: "natureza_transversal" | null;
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

const PADROES_METODOLOGIA: RegExp[] = [
  /\bmetodo cientifico\b/,
  /\bnatureza da ciencia\b/,
  /\bformulacao de (uma )?hipotese\b/,
  /\bapos a formulacao de (uma )?hipotese\b/,
  /\bsequencialmente\b.*\bhipotese\b/,
  /\bhipotese\b.*\b(experimento|experimentacao|coleta de dados)\b/,
  /\bcoleta de dados\b/,
  /\banalise de dados\b/,
  /\banalise critica\b/,
  /\binvestigacao cientifica\b/,
  /\babordagem sistematica\b/,
  /\betapas do metodo\b/,
  /\bsequencia do metodo cientifico\b/,
  /\bobservacao rigorosa\b/,
  /\bobservacao controlada\b/,
  /\bobservacao\b.*\bhipotese\b/,
  /\bexperimentacao\b.*\banalise\b/,
  /\bexperimentacao\b/,
  /\bexperimento\b.*\b(conclusao|analise)\b/,
];

/** Sinais fortes de disciplina — metodologia pura não deve perder para menção incidental. */
const PADROES_DISCIPLINAR_FORTES: RegExp[] = [
  /\b(celula|dna|genetica|cromossomo|fotossintese|ecossistema|virus|bacteria)\b/,
  /\b(reacao quimica|estequiometria|tabela periodica|ph\b|molecula|atomo)\b/,
  /\b(newton|velocidade|forca resultante|circuito eletrico|optica|termodinamica)\b/,
];

export const REGRA_NATUREZA_TRANSVERSAL_ID = "natureza_transversal_metodologia_cientifica";

export function triarNaturezaTransversal(enunciado: string): TriagemNaturezaTransversal {
  const texto = norm(enunciado);
  if (texto.length < 20) {
    return { catalogoId: null, confianca: 0, motivo: "texto curto" };
  }

  let scoreMet = 0;
  for (const p of PADROES_METODOLOGIA) {
    if (p.test(texto)) scoreMet += 1;
  }

  if (scoreMet === 0) {
    return { catalogoId: null, confianca: 0, motivo: "sem sinal de metodologia" };
  }

  let scoreDisc = 0;
  for (const p of PADROES_DISCIPLINAR_FORTES) {
    if (p.test(texto)) scoreDisc += 1;
  }

  if (scoreDisc >= 2) {
    return {
      catalogoId: null,
      confianca: 0.2,
      motivo: `conteúdo disciplinar forte (${scoreDisc}) prevalece sobre metodologia`,
    };
  }

  const confianca = Math.min(1, 0.55 + scoreMet * 0.15 - scoreDisc * 0.1);
  return {
    catalogoId: "natureza_transversal",
    confianca,
    motivo: `metodologia=${scoreMet} disciplinar=${scoreDisc}`,
  };
}
