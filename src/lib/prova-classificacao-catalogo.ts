import type { QuestaoExtraida } from "@/lib/ai-extract-prova";
import type { IdiomaVarianteQuestao } from "@/generated/prisma/client";
import {
  indexGlobalEscopos,
} from "@/lib/conhecimento-catalog/load";
import type { MateriaCorpusId } from "@/lib/enem-corpus-materia";
import { CORPUS_MATERIA_CONFIG } from "@/lib/enem-corpus-materia";
import { CLASSIFICADOR_CATALOGO_V11 } from "@/lib/enem-classificar/classificar-catalogo-v11";
import {
  versaoClassificacaoDisciplinaV10,
} from "@/lib/enem-classificar/classificar-roteamento-disciplina";
import {
  classificarQuestaoPipeline,
  type PayloadQuestaoCompleto,
  type MetaPipelineProva,
} from "@/lib/enem-classificar/classificar-pipeline-prova";
import {
  LABEL_DISCIPLINA_SPLIT,
  ehCatalogDisciplinaSplit,
} from "@/lib/conhecimento-catalog/disciplinas-split";
import { MARCADOR_EXTRACAO_ACEITA } from "@/lib/prova-texto-prova";
import type { ResultadoClassificacao } from "@/lib/conhecimento-catalog/types";
import { camposClassificacaoFromResultado } from "@/lib/canonical-question/persist-classificacao";
import { areaBlocoIdDeLabel, inferirAreaBlocoPorMateria } from "@/lib/areas-bloco";
import { chaveQuestaoVariante } from "@/lib/prova-idioma";
import type { ProvaQuestaoRow } from "@/lib/parse-prova-csv";

type CtxClassificacaoProva = {
  banca?: string;
  trechos?: Map<number, string>;
};

/** Texto mínimo para classificação N2 (enunciado + alternativas). */
export const TEXTO_MINIMO_CLASSIFICACAO = 80;
export const TEXTO_MINIMO_CLASSIFICACAO_CURTO = 12;

export type StatsClassificacaoN2 = {
  total: number;
  comEscopoReal: number;
  comFallback: number;
  semEscopo: number;
};

export function statsClassificacaoN2(rows: ProvaQuestaoRow[]): StatsClassificacaoN2 {
  let comEscopoReal = 0;
  let comFallback = 0;
  for (const row of rows) {
    const escopoId = row.conhecimentoEscopoId?.trim();
    if (!escopoId) continue;
    if (escopoId.endsWith(".__nao_classificado")) comFallback++;
    else comEscopoReal++;
  }
  const classificadas = comEscopoReal + comFallback;
  return {
    total: rows.length,
    comEscopoReal,
    comFallback,
    semEscopo: rows.length - classificadas,
  };
}

function textoQuestao(row: ProvaQuestaoRow, trechoFonte?: string): string {
  const partes: string[] = [];
  const en = row.enunciado?.trim();
  const trecho = trechoFonte?.trim();
  if (trecho && (!en || trecho.length > en.length + 40)) {
    partes.push(trecho);
  } else if (en) {
    partes.push(en);
  } else if (trecho) {
    partes.push(trecho);
  }
  const alt = row.alternativas?.trim();
  if (alt) partes.push(alt);
  if (partes.length === 0 && row.observacoes?.trim()) {
    partes.push(row.observacoes.trim());
  }
  return partes.join("\n\n");
}

function textoBaseQuestao(row: ProvaQuestaoRow, trechoFonte?: string): string | null {
  const en = row.enunciado?.trim();
  const trecho = trechoFonte?.trim();
  if (trecho && en && trecho.length > en.length + 40) return trecho;
  if (trecho && !en) return trecho;
  return null;
}

function resolverAreaPipeline(row: ProvaQuestaoRow): MetaPipelineProva["area"] {
  const areaId =
    areaBlocoIdDeLabel(row.areaBloco) ??
    areaBlocoIdDeLabel(inferirAreaBlocoPorMateria(row.materia));
  if (areaId === "linguagens") return "linguagens";
  if (areaId === "humanas") return "humanas";
  if (areaId === "exatas") return "exatas";
  if (areaId === "natureza") return "natureza";
  return undefined;
}

function textoMinimoClassificacao(row: ProvaQuestaoRow): number {
  if (row.observacoes?.includes(MARCADOR_EXTRACAO_ACEITA)) {
    return TEXTO_MINIMO_CLASSIFICACAO_CURTO;
  }
  return TEXTO_MINIMO_CLASSIFICACAO;
}

function rowParaPayload(
  row: ProvaQuestaoRow,
  ctx?: CtxClassificacaoProva
): PayloadQuestaoCompleto {
  const trecho = ctx?.trechos?.get(row.numero);
  const enunciado = row.enunciado?.trim() || trecho?.trim() || "";
  return {
    fonteId: chaveQuestaoVariante(row.numero, row.idiomaVariante ?? "COMUM"),
    numero: row.numero,
    idiomaVariante: row.idiomaVariante ?? "COMUM",
    areaBloco: row.areaBloco ?? null,
    banca: ctx?.banca ?? null,
    enunciado,
    alternativas: row.alternativas?.trim() ?? "",
    textoBase: textoBaseQuestao(row, trecho),
    gabarito: row.gabarito ?? null,
    observacoes: row.observacoes ?? null,
  };
}

/** Labels a partir do catálogo N2 — sem taxonomy legada. */
export function labelsFromEscopoN2(resultado: ResultadoClassificacao): {
  materia: string;
  assunto: string;
} {
  const entry = resultado.escopoId ? indexGlobalEscopos().get(resultado.escopoId) : null;
  const discId = resultado.disciplinaOriginalId ?? resultado.materiaId;

  if (discId && ehCatalogDisciplinaSplit(discId)) {
    const materia = LABEL_DISCIPLINA_SPLIT[discId];
    if (!resultado.escopoId) return { materia, assunto: "N2 pendente" };
    if (resultado.escopoId.endsWith(".__nao_classificado")) {
      return { materia, assunto: "Escopo N2 pendente (revisar)" };
    }
    return { materia, assunto: entry?.escopoLabel ?? resultado.escopoId };
  }

  const cfg = resultado.materiaId
    ? CORPUS_MATERIA_CONFIG[resultado.materiaId as MateriaCorpusId]
    : undefined;
  const materia = cfg?.label ?? "A classificar";
  if (!resultado.escopoId) return { materia, assunto: "N2 pendente" };
  if (resultado.escopoId.endsWith(".__nao_classificado")) {
    return { materia, assunto: "Escopo N2 pendente (revisar)" };
  }
  return { materia, assunto: entry?.escopoLabel ?? resultado.escopoId };
}

/** @deprecated Use labelsFromEscopoN2 */
export const labelsLegadosFromResultado = labelsFromEscopoN2;

function disciplinaFromResultado(resultado: ResultadoClassificacao): string | null {
  const disc = resultado.disciplinaOriginalId ?? resultado.materiaId;
  if (disc && ehCatalogDisciplinaSplit(disc)) {
    return LABEL_DISCIPLINA_SPLIT[disc];
  }
  if (resultado.materiaId && CORPUS_MATERIA_CONFIG[resultado.materiaId as MateriaCorpusId]) {
    return CORPUS_MATERIA_CONFIG[resultado.materiaId as MateriaCorpusId].label;
  }
  return null;
}

function versaoFromResultado(
  resultado: ResultadoClassificacao,
  row: ProvaQuestaoRow
): string {
  const mid = resultado.materiaId ?? "";
  if (ehCatalogDisciplinaSplit(mid)) {
    const area = ["portugues", "ingles", "espanhol"].includes(mid)
      ? "linguagens"
      : "humanas";
    return versaoClassificacaoDisciplinaV10(resultado, area);
  }
  const areaRow = resolverAreaPipeline(row);
  if (areaRow === "humanas" || areaRow === "linguagens") {
    return versaoClassificacaoDisciplinaV10(resultado, areaRow);
  }
  return `${CLASSIFICADOR_CATALOGO_V11}|pipeline|${mid || "?"}`;
}

function aplicarResultadoNaRow(
  row: ProvaQuestaoRow,
  resultado: ResultadoClassificacao,
  versao: string
): ProvaQuestaoRow {
  const campos = camposClassificacaoFromResultado(resultado, versao);
  const { materia, assunto } = labelsFromEscopoN2(resultado);
  const temEscopo = Boolean(campos.conhecimentoEscopoId);
  const disciplinaRoteada = disciplinaFromResultado(resultado);

  return {
    ...row,
    materia: temEscopo ? materia : disciplinaRoteada ?? "A classificar",
    assunto: temEscopo ? assunto : disciplinaRoteada ? "Rota definida — N2 pendente" : "A classificar",
    conhecimentoExigido:
      campos.conhecimentoExigido ?? row.conhecimentoExigido ?? undefined,
    conhecimentoEscopoId: campos.conhecimentoEscopoId ?? undefined,
    conhecimentoDominioId: campos.conhecimentoDominioId ?? undefined,
    classificacaoVersao: campos.classificacaoVersao ?? undefined,
    classificacaoConfianca: campos.classificacaoConfianca ?? undefined,
    classificacaoSecundariosJson: campos.classificacaoSecundariosJson ?? undefined,
    conceitosCanonicosJson: campos.conceitosCanonicosJson ?? undefined,
  };
}

/**
 * Classifica questões — pipeline sequencial: 1 questão por vez, 1 passo IA por vez.
 */
export async function classificarRowsProvaComCatalogo(
  rows: ProvaQuestaoRow[],
  ctx?: CtxClassificacaoProva
): Promise<{ rows: ProvaQuestaoRow[]; avisos: string[]; etapas: string[] }> {
  const avisos: string[] = [];
  const etapas: string[] = ["Modo: pipeline unitário (1 questão · 1 passo IA por chamada)"];

  const resultados = new Map<string, ResultadoClassificacao>();

  for (const row of rows) {
    const trecho = ctx?.trechos?.get(row.numero);
    const texto = textoQuestao(row, trecho);
    const minimo = textoMinimoClassificacao(row);

    if (texto.length < minimo) {
      avisos.push(
        `Q${row.numero}: texto insuficiente (${texto.length} chars, mín. ${minimo}).`
      );
      continue;
    }

    const area = resolverAreaPipeline(row);
    if (!area) {
      avisos.push(`Q${row.numero}: área indefinida — classificação adiada.`);
      continue;
    }

    const payload = rowParaPayload(row, ctx);
    const { resultado, etapas: etapasQ, avisos: avisosQ } = await classificarQuestaoPipeline(
      payload,
      area
    );

    for (const e of etapasQ) {
      etapas.push(e.detalhe);
    }
    avisos.push(...avisosQ);

    if (resultado) {
      resultados.set(payload.fonteId, resultado);
    }
  }

  const saida = rows.map((row) => {
    const fonteId = chaveQuestaoVariante(row.numero, row.idiomaVariante ?? "COMUM");
    const resultado = resultados.get(fonteId);
    if (!resultado) return row;
    return aplicarResultadoNaRow(row, resultado, versaoFromResultado(resultado, row));
  });

  const stats = statsClassificacaoN2(saida);
  etapas.push(
    `Resumo: N2 real ${stats.comEscopoReal} · fallback ${stats.comFallback} · sem escopo ${stats.semEscopo}`
  );

  return { rows: saida, avisos, etapas };
}

export type QuestaoProvaClassificadaCatalogo = QuestaoExtraida &
  Pick<
    ProvaQuestaoRow,
    | "idiomaVariante"
    | "enunciado"
    | "gabarito"
    | "conhecimentoEscopoId"
    | "conhecimentoDominioId"
    | "classificacaoVersao"
    | "classificacaoConfianca"
    | "classificacaoSecundariosJson"
    | "conceitosCanonicosJson"
  >;

export async function classificarQuestaoProvaComCatalogo(input: {
  numero: number;
  idiomaVariante?: IdiomaVarianteQuestao;
  trechoEnunciado: string;
  areaBloco?: string | null;
  materia?: string;
  gabarito?: string | null;
  banca?: string | null;
  observacoes?: string | null;
  alternativas?: string | null;
}): Promise<QuestaoProvaClassificadaCatalogo> {
  const row: ProvaQuestaoRow = {
    numero: input.numero,
    idiomaVariante: input.idiomaVariante ?? "COMUM",
    areaBloco: input.areaBloco ?? undefined,
    materia: input.materia ?? "A classificar",
    assunto: "A classificar",
    enunciado: input.trechoEnunciado.trim(),
    alternativas: input.alternativas?.trim() || undefined,
    observacoes: input.observacoes?.trim() || undefined,
    gabarito: input.gabarito ?? undefined,
  };

  const { rows } = await classificarRowsProvaComCatalogo([row], {
    banca: input.banca ?? undefined,
  });
  const classificada = rows[0]!;

  return {
    numero: classificada.numero,
    trechoEnunciado: input.trechoEnunciado.trim(),
    materia: classificada.materia,
    assunto: classificada.assunto,
    areaBloco: classificada.areaBloco,
    conhecimentoExigido: classificada.conhecimentoExigido,
    nivelDificuldade: classificada.nivelDificuldade,
    observacoes: classificada.observacoes ?? input.observacoes?.trim() ?? undefined,
    idiomaVariante: classificada.idiomaVariante,
    enunciado: classificada.enunciado,
    gabarito: classificada.gabarito,
    conhecimentoEscopoId: classificada.conhecimentoEscopoId ?? undefined,
    conhecimentoDominioId: classificada.conhecimentoDominioId ?? undefined,
    classificacaoVersao: classificada.classificacaoVersao ?? undefined,
    classificacaoConfianca: classificada.classificacaoConfianca ?? undefined,
    classificacaoSecundariosJson: classificada.classificacaoSecundariosJson ?? undefined,
    conceitosCanonicosJson: classificada.conceitosCanonicosJson ?? undefined,
  };
}

export type ReclassificarProvaInteiraResult = {
  total: number;
  processadas: number;
  classificadas: number;
  comEscopoReal: number;
  comFallback: number;
  semEscopo: number;
  semTexto: number;
  avisos: string[];
  etapas: string[];
};

export async function reclassificarProvaInteiraComCatalogo(
  _provaId: string,
  _opts?: { banca?: string | null }
): Promise<ReclassificarProvaInteiraResult> {
  throw new Error(
    "Reclassificação monolítica desativada. Use as fases N1 → N2 → N3 via API ou admin."
  );
}

export { CLASSIFICADOR_CATALOGO_V11 } from "@/lib/enem-classificar/classificar-catalogo-v11";
export { CLASSIFICADOR_DISCIPLINA_V10 } from "@/lib/enem-classificar/classificar-roteamento-disciplina";
