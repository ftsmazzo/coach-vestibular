/**
 * Etapa 4C — qualidade do foco inicial da Semana 1 e score de priorização.
 */
import type { BaselineEscopoJornada } from "@/lib/jornada-diagnostico-inicial";

export type NivelQualidadeFoco = "FORTE" | "ACEITAVEL" | "FRACO";

export const SCORE_MINIMO_FOCO_SEMANA1 = 10;

export type InputEscopoFoco = {
  escopoId: string;
  escopoLabel: string;
  n1: string;
  total: number;
  erros: number;
  provasComErro: number;
  pctErro: number;
  pesoDiagnostico?: number;
  tiposErro: Record<string, number>;
  conhecimentosExigidos: string[];
  estadoInicial?: string;
};

export type ResultadoQualidadeFoco = {
  aprovado: boolean;
  motivoRejeicao?: string;
  scoreQualidade: number;
  nivel: NivelQualidadeFoco;
  penalizadores: string[];
  bonus: string[];
};

export type FocoInglesElevado = {
  titulo: string;
  motivo: string;
  escoposOriginais: string[];
  escopoIdReferencia: string | null;
};

const N1_ESTRUTURANTES = new Set([
  "matematica",
  "mat",
  "portugues",
  "pt",
  "biologia",
  "bio",
  "fisica",
  "fis",
  "quimica",
  "quim",
  "historia",
  "hist",
  "geografia",
  "geo",
  "filosofia",
  "sociologia",
  "natureza",
  "humanas",
  "linguagens",
]);

const PADROES_MICRO_INGLES = [
  /preposition/i,
  /preposi/i,
  /article/i,
  /determiner/i,
  /noun phrase/i,
  /phrasal verb/i,
  /collocation/i,
  /adjective order/i,
  /plural/i,
  /countable/i,
];

export function n1DeEscopo(escopoId: string): string {
  return escopoId.split(".")[0]?.toLowerCase() ?? "";
}

export function isEscopoIngles(escopoId: string): boolean {
  return n1DeEscopo(escopoId) === "ing";
}

export function isMicroescopoIngles(escopoId: string, escopoLabel: string): boolean {
  if (!isEscopoIngles(escopoId)) return false;
  const texto = `${escopoId} ${escopoLabel}`.toLowerCase();
  if (PADROES_MICRO_INGLES.some((p) => p.test(texto))) return true;
  const partes = escopoId.split(".");
  return partes.length >= 5 || (partes.includes("grammar") && partes.length >= 4);
}

export function isN1Estruturante(n1: string): boolean {
  const id = n1.toLowerCase();
  if (N1_ESTRUTURANTES.has(id)) return true;
  return [...N1_ESTRUTURANTES].some((m) => id.startsWith(m));
}

export function calcularPesoDiagnosticoEscopoAprimorado(
  opts: {
    escopoId: string;
    escopoLabel: string;
    erros: number;
    total: number;
    provasComErro: number;
    modoUsoMedio: number;
    bancaPesoMedio: number;
    tiposErroRecorrentes: number;
    n3Distintos: number;
    tiposErro: Record<string, number>;
    conhecimentosExigidos: string[];
  },
  alternativas: InputEscopoFoco[] = []
): number {
  const n1 = n1DeEscopo(opts.escopoId);
  const pctErro = opts.total > 0 ? opts.erros / opts.total : 0;
  const input: InputEscopoFoco = {
    escopoId: opts.escopoId,
    escopoLabel: opts.escopoLabel,
    n1,
    total: opts.total,
    erros: opts.erros,
    provasComErro: opts.provasComErro,
    pctErro,
    tiposErro: opts.tiposErro,
    conhecimentosExigidos: opts.conhecimentosExigidos,
  };
  const base =
    opts.erros * 2 +
    opts.provasComErro * 3 +
    opts.modoUsoMedio +
    opts.bancaPesoMedio +
    (opts.tiposErroRecorrentes >= 2 ? 2 : opts.tiposErroRecorrentes === 1 ? 1 : 0) +
    (opts.n3Distintos >= 2 ? 2 : opts.n3Distintos >= 1 ? 1 : 0);

  const qualidade = avaliarQualidadeFocoInicial(input, alternativas);
  return Math.round((base * 0.45 + qualidade.scoreQualidade * 0.55) * 10) / 10;
}

export function avaliarQualidadeFocoInicial(
  escopo: InputEscopoFoco,
  alternativas: InputEscopoFoco[] = []
): ResultadoQualidadeFoco {
  let score = escopo.pesoDiagnostico ?? escopo.erros * 2 + escopo.provasComErro * 3;
  const penalizadores: string[] = [];
  const bonus: string[] = [];

  if (escopo.total < 3) {
    score -= 7;
    penalizadores.push("amostra muito baixa");
  } else if (escopo.total < 5) {
    score -= 4;
    penalizadores.push("amostra limitada");
  }

  if (escopo.erros <= 1) {
    score -= 6;
    penalizadores.push("erro insuficiente para foco semanal");
  } else if (escopo.erros === 2) {
    score -= 3;
    penalizadores.push("poucos erros analisáveis");
  }

  const microIngles = isMicroescopoIngles(escopo.escopoId, escopo.escopoLabel);
  if (microIngles) {
    score -= 9;
    penalizadores.push("microescopo gramatical de inglês");
  }

  if (isEscopoIngles(escopo.escopoId) && escopo.escopoId.includes("grammar")) {
    score -= 4;
    penalizadores.push("gramática de baixa transferência");
  }

  if (escopo.provasComErro >= 2 && escopo.erros <= 3 && escopo.total <= 6) {
    score -= 6;
    penalizadores.push("recorrência fraca com pouca amostra");
  }

  if (escopo.provasComErro >= 2 && escopo.erros <= 3 && !penalizadores.includes("recorrência fraca com pouca amostra")) {
    score -= 2;
    penalizadores.push("recorrência sem volume de erro");
  }

  const tiposRecorrentes = Object.values(escopo.tiposErro).filter((n) => n >= 2).length;
  if (tiposRecorrentes >= 1) {
    score += 3;
    bonus.push("padrão cognitivo recorrente");
  }

  if (escopo.conhecimentosExigidos.length >= 2) {
    score += 2;
    bonus.push("múltiplos conhecimentos semelhantes (N3)");
  }

  if (isN1Estruturante(escopo.n1) && escopo.total >= 5 && escopo.erros >= 3) {
    score += 6;
    bonus.push("fragilidade estruturante com amostra razoável");
  }

  if (escopo.pctErro >= 0.5 && escopo.total >= 4) {
    score += 2;
    bonus.push("taxa de erro relevante no escopo");
  }

  const melhorEstruturante = alternativas
    .filter(
      (a) =>
        isN1Estruturante(a.n1) &&
        !isMicroescopoIngles(a.escopoId, a.escopoLabel) &&
        a.erros >= 3 &&
        a.total >= 4
    )
    .sort((a, b) => b.erros * b.total - a.erros * a.total)[0];

  if (microIngles && melhorEstruturante) {
    score -= 7;
    penalizadores.push("há fragilidade mais estruturante em outra área");
  } else if (
    microIngles &&
    alternativas.some(
      (a) =>
        isN1Estruturante(a.n1) &&
        !isMicroescopoIngles(a.escopoId, a.escopoLabel) &&
        a.erros >= escopo.erros &&
        a.total >= escopo.total
    )
  ) {
    score -= 5;
    penalizadores.push("alternativa mais estruturante disponível");
  }

  const nivel: NivelQualidadeFoco =
    score >= 20 ? "FORTE" : score >= SCORE_MINIMO_FOCO_SEMANA1 ? "ACEITAVEL" : "FRACO";
  const aprovado = score >= SCORE_MINIMO_FOCO_SEMANA1;

  return {
    aprovado,
    motivoRejeicao: aprovado
      ? undefined
      : penalizadores[0] ?? "qualidade insuficiente para foco inicial da Semana 1",
    scoreQualidade: Math.round(score * 10) / 10,
    nivel,
    penalizadores,
    bonus,
  };
}

export function inputEscopoFromBaseline(
  linha: BaselineEscopoJornada,
  escopoLabel: string
): InputEscopoFoco {
  return {
    escopoId: linha.escopoId,
    escopoLabel,
    n1: n1DeEscopo(linha.escopoId),
    total: linha.total,
    erros: linha.erros,
    provasComErro: linha.provasComErro,
    pctErro: linha.total > 0 ? linha.erros / linha.total : 0,
    pesoDiagnostico: linha.pesoDiagnostico,
    tiposErro: linha.tiposErro,
    conhecimentosExigidos: linha.conhecimentosExigidos,
    estadoInicial: linha.estadoInicial,
  };
}

export function tentarElevarFocoIngles(
  escopos: InputEscopoFoco[],
  escopoPrincipal: InputEscopoFoco
): FocoInglesElevado | null {
  if (!isEscopoIngles(escopoPrincipal.escopoId)) return null;
  if (!isMicroescopoIngles(escopoPrincipal.escopoId, escopoPrincipal.escopoLabel)) return null;

  const micros = escopos.filter((e) => isEscopoIngles(e.escopoId) && e.erros > 0);
  const labels = micros
    .filter((e) => isMicroescopoIngles(e.escopoId, e.escopoLabel))
    .map((e) => e.escopoLabel.toLowerCase())
    .slice(0, 3);

  const detalhe =
    labels.length > 0
      ? labels.join(", ")
      : escopoPrincipal.escopoLabel.toLowerCase();

  return {
    titulo: "Leitura e pistas linguísticas em inglês",
    motivo:
      `Nas questões de inglês, os erros se concentraram em pistas linguísticas de sentido — especialmente ${detalhe}. ` +
      "Por isso, a semana vai trabalhar leitura orientada de enunciado e marcação de relações de sentido, não gramática isolada.",
    escoposOriginais: micros.map((e) => e.escopoId),
    escopoIdReferencia: escopoPrincipal.escopoId,
  };
}

export function motivoPrioridadeEnriquecido(
  linha: BaselineEscopoJornada,
  escopoLabel: string,
  qualidade: ResultadoQualidadeFoco,
  rejeitouMicroIngles?: boolean
): string {
  if (rejeitouMicroIngles) {
    return (
      "Apesar de haver erros recorrentes em inglês, eles têm baixa amostra e parecem microtópicos. " +
      "Para a primeira semana, o motor priorizou um foco mais estruturante."
    );
  }

  if (isMicroescopoIngles(linha.escopoId, escopoLabel)) {
    return (
      `Nas questões de inglês, os erros se concentraram em pistas linguísticas de sentido — especialmente ${escopoLabel.toLowerCase()}. ` +
      "A semana trabalha leitura orientada e relações de sentido, não gramática isolada."
    );
  }

  const partes: string[] = [];
  if (linha.erros >= 3 && linha.provasComErro >= 2) {
    partes.push(
      `${escopoLabel} apareceu em ${linha.provasComErro} provas com ${linha.erros} erros analisáveis em ${linha.total} questões do escopo`
    );
  } else if (linha.erros >= 3) {
    partes.push(
      `${linha.erros} erros analisáveis em ${linha.total} questões de ${escopoLabel} na amostra inicial`
    );
  } else {
    partes.push(`${linha.erros} erro(s) em ${escopoLabel} com classificação completa`);
  }

  if (qualidade.bonus.includes("fragilidade estruturante com amostra razoável")) {
    partes.push("área estruturante com volume de evidência suficiente para intervenção semanal");
  }
  if (qualidade.bonus.includes("padrão cognitivo recorrente")) {
    partes.push("padrão de erro cognitivo recorrente");
  }

  return `${partes.join(" — ")}.`;
}

export function motivoEscopoCriticoEnriquecido(
  linha: BaselineEscopoJornada,
  escopoLabel: string
): string {
  const qualidade = avaliarQualidadeFocoInicial(inputEscopoFromBaseline(linha, escopoLabel));
  return motivoPrioridadeEnriquecido(linha, escopoLabel, qualidade);
}

export function selecionarMelhorFocoSemana1(
  candidatos: InputEscopoFoco[],
  minScore = SCORE_MINIMO_FOCO_SEMANA1
): { escolhido: InputEscopoFoco | null; rejeitados: Array<{ escopo: InputEscopoFoco; motivo: string }> } {
  const rejeitados: Array<{ escopo: InputEscopoFoco; motivo: string }> = [];
  const ranqueados = [...candidatos]
    .map((c) => ({
      escopo: c,
      qualidade: avaliarQualidadeFocoInicial(c, candidatos),
    }))
    .sort((a, b) => b.qualidade.scoreQualidade - a.qualidade.scoreQualidade);

  for (const row of ranqueados) {
    if (row.qualidade.aprovado && row.qualidade.scoreQualidade >= minScore) {
      return { escolhido: row.escopo, rejeitados };
    }
    rejeitados.push({
      escopo: row.escopo,
      motivo: row.qualidade.motivoRejeicao ?? "score abaixo do mínimo",
    });
  }

  const fallback = ranqueados.find((r) => r.qualidade.nivel === "ACEITAVEL") ?? ranqueados[0];
  return { escolhido: fallback?.escopo ?? null, rejeitados };
}
