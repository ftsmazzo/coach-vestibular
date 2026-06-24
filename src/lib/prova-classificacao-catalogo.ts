import type { QuestaoExtraida } from "@/lib/ai-extract-prova";
import type { IdiomaVarianteQuestao } from "@/generated/prisma/client";
import {
  carregarCatalogoMateria,
  indexarEscopos,
  indexGlobalEscopos,
} from "@/lib/conhecimento-catalog/load";
import type { MateriaCorpusId } from "@/lib/enem-corpus-materia";
import { CORPUS_MATERIA_CONFIG } from "@/lib/enem-corpus-materia";
import {
  CLASSIFICADOR_CATALOGO_V11,
  classificarLoteCatalogoV11,
} from "@/lib/enem-classificar/classificar-catalogo-v11";
import {
  classificarLoteHumanasV10,
  classificarLoteLinguagensV20,
  versaoClassificacaoDisciplinaV10,
  type QuestaoRoteamento,
} from "@/lib/enem-classificar/classificar-roteamento-disciplina";
import {
  LABEL_DISCIPLINA_SPLIT,
  ehCatalogDisciplinaSplit,
} from "@/lib/conhecimento-catalog/disciplinas-split";
import { MARCADOR_EXTRACAO_ACEITA } from "@/lib/prova-texto-prova";
import {
  triarMateriaNatureza,
  type MateriaNatureza,
} from "@/lib/enem-classificar/triagem-natureza";
import type { ResultadoClassificacao } from "@/lib/conhecimento-catalog/types";
import { camposClassificacaoFromResultado } from "@/lib/canonical-question/persist-classificacao";
import { escopoIdParaTaxonomy } from "@/lib/taxonomy-catalog-bridge";
import { areaBlocoIdDeLabel, inferirAreaBlocoPorMateria } from "@/lib/areas-bloco";
import { chaveQuestaoVariante } from "@/lib/prova-idioma";
import type { ProvaQuestaoRow } from "@/lib/parse-prova-csv";
import { taxonomy } from "@/lib/taxonomy";
import {
  normalizarLabelAssunto,
  normalizarLabelMateria,
} from "@/lib/taxonomia-validacao";
import { prisma } from "@/lib/prisma";
import { atualizarClassificacaoLote } from "@/lib/prova-questoes-persist";

const LOTE_CATALOGO = 4;
const LOTE_ROTEAMENTO = 6;

/** Texto mínimo para classificação N2 (enunciado + alternativas). */
export const TEXTO_MINIMO_CLASSIFICACAO = 80;
export const TEXTO_MINIMO_CLASSIFICACAO_CURTO = 12;

const MAP_HUMANAS_ASSUNTO: Record<string, string> = {
  historia_brasil: "História",
  historia_geral: "História",
  geografia: "Geografia",
  filosofia: "Filosofia",
  sociologia: "Sociologia",
};

const DISC_LING_PARA_MATERIA: Record<string, string> = {
  portugues: "Português",
  ingles: "Inglês",
  espanhol: "Espanhol",
};

type AreaAgregada = "humanas" | "linguagens";
type DestinoClassificacao =
  | { tipo: "catalogo_direto"; materiaId: MateriaCorpusId }
  | { tipo: "area_agregada"; area: AreaAgregada };

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function textoQuestao(row: ProvaQuestaoRow): string {
  const partes: string[] = [];
  const en = row.enunciado?.trim();
  if (en) partes.push(en);
  const alt = row.alternativas?.trim();
  if (alt) partes.push(alt);
  if (partes.length === 0) {
    const obs = row.observacoes?.trim();
    if (obs) partes.push(obs);
  }
  return partes.join("\n\n").slice(0, 6000);
}

function hintIdioma(variante?: ProvaQuestaoRow["idiomaVariante"]): string | null {
  if (variante === "INGLES") return "ingles";
  if (variante === "ESPANHOL") return "espanhol";
  return null;
}

function versaoCatalogoV11(materiaId: MateriaCorpusId): string {
  const catalog = carregarCatalogoMateria(materiaId);
  return `${CLASSIFICADOR_CATALOGO_V11}|${catalog.catalogVersion ?? "1.2"}`;
}

/** Rótulos legados (materia/assunto) derivados do escopo N2 — compatível com UI e taxonomy.json. */
export function labelsLegadosFromResultado(resultado: ResultadoClassificacao): {
  materia: string;
  assunto: string;
} {
  const entry = resultado.escopoId ? indexGlobalEscopos().get(resultado.escopoId) : null;
  const catalogMateriaId = resultado.materiaId ?? entry?.materiaId ?? null;

  if (catalogMateriaId && ehCatalogDisciplinaSplit(catalogMateriaId)) {
    const materia = LABEL_DISCIPLINA_SPLIT[catalogMateriaId];
    const tax = resultado.escopoId
      ? escopoIdParaTaxonomy(resultado.escopoId, catalogMateriaId)
      : null;
    if (tax?.temaId) {
      const mat = taxonomy.materias.find((m) => m.id === tax.materiaId);
      const tema = mat?.temas.find((t) => t.id === tax.temaId);
      if (tema) return { materia, assunto: tema.label };
    }
    const assunto = entry?.escopoLabel ?? entry?.assuntoLabel ?? "A classificar";
    return { materia, assunto: normalizarLabelAssunto(materia, assunto) };
  }

  if (resultado.materiaId === "linguagens" || resultado.disciplinaOriginalId) {
    const disc = resultado.disciplinaOriginalId ?? "portugues";
    const materia =
      DISC_LING_PARA_MATERIA[disc] ??
      (disc === "indefinido" ? "Português" : "Português");
    const tax = resultado.escopoId
      ? escopoIdParaTaxonomy(resultado.escopoId)
      : null;
    if (tax?.temaId) {
      const mat = taxonomy.materias.find((m) => m.id === tax.materiaId);
      const tema = mat?.temas.find((t) => t.id === tax.temaId);
      if (tema) return { materia, assunto: tema.label };
    }
    const assunto = entry?.escopoLabel ?? entry?.assuntoLabel ?? "A classificar";
    return { materia, assunto: normalizarLabelAssunto(materia, assunto) };
  }

  if (resultado.materiaId === "humanas") {
    const tax = resultado.escopoId ? escopoIdParaTaxonomy(resultado.escopoId) : null;
    if (tax) {
      const mat = taxonomy.materias.find((m) => m.id === tax.materiaId);
      const tema = mat?.temas.find((t) => t.id === tax.temaId);
      return {
        materia: mat?.label ?? "História",
        assunto: normalizarLabelAssunto(
          mat?.label ?? "História",
          tema?.label ?? entry?.escopoLabel ?? "A classificar"
        ),
      };
    }
    const materia =
      (entry?.assuntoId && MAP_HUMANAS_ASSUNTO[entry.assuntoId]) ?? "História";
    return {
      materia,
      assunto: normalizarLabelAssunto(
        materia,
        entry?.escopoLabel ?? entry?.assuntoLabel ?? "A classificar"
      ),
    };
  }

  const cfg = catalogMateriaId ? CORPUS_MATERIA_CONFIG[catalogMateriaId as MateriaCorpusId] : undefined;
  const materia =
    cfg?.label ??
    normalizarLabelMateria(catalogMateriaId ?? "A classificar");
  const tax =
    resultado.escopoId && catalogMateriaId
      ? escopoIdParaTaxonomy(resultado.escopoId, catalogMateriaId)
      : null;
  if (tax?.temaId) {
    const mat = taxonomy.materias.find((m) => m.id === tax.materiaId);
    const tema = mat?.temas.find((t) => t.id === tax.temaId);
    if (tema) return { materia, assunto: tema.label };
  }
  const assunto = entry?.escopoLabel ?? entry?.assuntoLabel ?? "A classificar";
  return { materia, assunto: normalizarLabelAssunto(materia, assunto) };
}

const MAP_NATUREZA_CORPUS: Record<MateriaNatureza, MateriaCorpusId> = {
  Biologia: "biologia",
  Química: "quimica",
  Física: "fisica",
};

function materiaCorpusNatureza(texto: string, materiaLegada?: string): MateriaCorpusId | null {
  if (materiaLegada === "Química") return "quimica";
  if (materiaLegada === "Física") return "fisica";
  if (materiaLegada === "Biologia") return "biologia";
  const tri = triarMateriaNatureza(texto);
  return tri.materia ? MAP_NATUREZA_CORPUS[tri.materia] : null;
}

function resolverDestinoClassificacao(
  row: ProvaQuestaoRow,
  texto: string
): { destino: DestinoClassificacao | null; aviso?: string } {
  const area = resolverAreaCatalogo(row);

  if (area === "linguagens") return { destino: { tipo: "area_agregada", area: "linguagens" } };
  if (area === "humanas") return { destino: { tipo: "area_agregada", area: "humanas" } };
  if (area === "matematica") return { destino: { tipo: "catalogo_direto", materiaId: "matematica" } };

  if (area === "natureza") {
    const materiaId = materiaCorpusNatureza(texto, row.materia);
    if (materiaId) return { destino: { tipo: "catalogo_direto", materiaId } };
    return {
      destino: null,
      aviso: `Q${row.numero}: Natureza — triagem Bio/Quím/Fís inconclusiva; classificação adiada.`,
    };
  }

  const triNat = triarMateriaNatureza(texto);
  if (triNat.materia) {
    return {
      destino: {
        tipo: "catalogo_direto",
        materiaId: MAP_NATUREZA_CORPUS[triNat.materia],
      },
      aviso: `Q${row.numero}: área indefinida — triagem Natureza → ${triNat.materia}.`,
    };
  }

  return {
    destino: null,
    aviso: `Q${row.numero}: área indefinida — classificação adiada (sem fallback).`,
  };
}

function textoMinimoClassificacao(row: ProvaQuestaoRow, texto: string): number {
  if (row.observacoes?.includes(MARCADOR_EXTRACAO_ACEITA)) {
    return TEXTO_MINIMO_CLASSIFICACAO_CURTO;
  }
  return TEXTO_MINIMO_CLASSIFICACAO;
}

function rowParaQuestaoRoteamento(
  fonteId: string,
  row: ProvaQuestaoRow,
  ctx?: { banca?: string }
): QuestaoRoteamento {
  const enunciado = row.enunciado?.trim() ?? "";
  return {
    fonteId,
    enunciado,
    alternativas: row.alternativas?.trim() ?? "",
    gabarito: row.gabarito ?? null,
    numero: row.numero,
    idioma: hintIdioma(row.idiomaVariante),
    areaBloco: row.areaBloco ?? null,
    banca: ctx?.banca ?? null,
  };
}

function resolverAreaCatalogo(row: ProvaQuestaoRow): MateriaCorpusId | "natureza" | null {
  const areaId =
    areaBlocoIdDeLabel(row.areaBloco) ??
    areaBlocoIdDeLabel(inferirAreaBlocoPorMateria(row.materia));

  if (areaId === "linguagens") return "linguagens";
  if (areaId === "humanas") return "humanas";
  if (areaId === "exatas") return "matematica";
  if (areaId === "natureza") return "natureza";
  return null;
}

function versaoFromResultado(
  resultado: ResultadoClassificacao,
  row: ProvaQuestaoRow
): string {
  const mid = resultado.materiaId ?? "";
  if (ehCatalogDisciplinaSplit(mid)) {
    const area: AreaAgregada = ["portugues", "ingles", "espanhol"].includes(mid)
      ? "linguagens"
      : "humanas";
    return versaoClassificacaoDisciplinaV10(resultado, area);
  }
  if (mid === "humanas" || mid === "linguagens") {
    return versaoClassificacaoDisciplinaV10(
      resultado,
      mid as AreaAgregada
    );
  }
  const areaRow = resolverAreaCatalogo(row);
  if (areaRow === "humanas" || areaRow === "linguagens") {
    return versaoClassificacaoDisciplinaV10(resultado, areaRow);
  }
  return versaoCatalogoV11(
    (mid ||
      indexGlobalEscopos().get(resultado.escopoId ?? "")?.materiaId ||
      "matematica") as MateriaCorpusId
  );
}

function aplicarResultadoNaRow(
  row: ProvaQuestaoRow,
  resultado: ResultadoClassificacao,
  versao: string
): ProvaQuestaoRow {
  const campos = camposClassificacaoFromResultado(resultado, versao);
  const { materia, assunto } = labelsLegadosFromResultado(resultado);
  const temEscopo = Boolean(campos.conhecimentoEscopoId);

  return {
    ...row,
    materia: temEscopo ? materia : "A classificar",
    assunto: temEscopo ? assunto : "A classificar",
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

async function classificarLoteMateria(
  materiaId: MateriaCorpusId,
  items: Array<{
    fonteId: string;
    row: ProvaQuestaoRow;
  }>,
  ctx?: { banca?: string }
): Promise<Map<string, ResultadoClassificacao>> {
  const map = new Map<string, ResultadoClassificacao>();
  if (items.length === 0) return map;

  const catalog = carregarCatalogoMateria(materiaId);
  const escopos = indexarEscopos(catalog);

  for (const lote of chunks(items, LOTE_CATALOGO)) {
    const payload = lote.map(({ fonteId, row }) => ({
      fonteId,
      enunciado: textoQuestao(row),
      alternativas: row.alternativas?.trim() ?? "",
      gabarito: row.gabarito ?? null,
      numero: row.numero,
      idioma: hintIdioma(row.idiomaVariante),
    }));
    const parcial = await classificarLoteCatalogoV11(payload, catalog, escopos);
    for (const [k, v] of parcial) map.set(k, v);
  }

  return map;
}

async function classificarLoteAreaAgregada(
  area: AreaAgregada,
  items: Array<{ fonteId: string; row: ProvaQuestaoRow }>,
  ctx?: { banca?: string }
): Promise<Map<string, ResultadoClassificacao>> {
  const map = new Map<string, ResultadoClassificacao>();
  if (items.length === 0) return map;

  const classificarLote =
    area === "humanas" ? classificarLoteHumanasV10 : classificarLoteLinguagensV20;

  for (const lote of chunks(items, LOTE_ROTEAMENTO)) {
    const payload = lote.map(({ fonteId, row }) =>
      rowParaQuestaoRoteamento(fonteId, row, ctx)
    );
    const parcial = await classificarLote(payload);
    for (const [k, v] of parcial) map.set(k, v);
  }

  return map;
}

/**
 * Classifica questões de prova (PDF/CSV) com catálogo N2 v1.2 — mesmo motor do corpus ENEM.
 */
export async function classificarRowsProvaComCatalogo(
  rows: ProvaQuestaoRow[],
  ctx?: { banca?: string }
): Promise<{ rows: ProvaQuestaoRow[]; avisos: string[]; etapas: string[] }> {
  const avisos: string[] = [];
  const etapas: string[] = [];
  const porDestino = new Map<
    string,
    Array<{ fonteId: string; row: ProvaQuestaoRow }>
  >();

  for (const row of rows) {
    const fonteId = chaveQuestaoVariante(row.numero, row.idiomaVariante ?? "COMUM");
    const texto = textoQuestao(row);
    const minimo = textoMinimoClassificacao(row, texto);
    if (texto.length < minimo) {
      avisos.push(
        `Q${row.numero}: texto insuficiente (${texto.length} chars, mín. ${minimo}) — complete enunciado/alternativas ou aceite enunciado curto.`
      );
      continue;
    }

    const { destino, aviso } = resolverDestinoClassificacao(row, texto);
    if (aviso) avisos.push(aviso);
    if (!destino) continue;

    const chave =
      destino.tipo === "area_agregada"
        ? `area:${destino.area}`
        : `cat:${destino.materiaId}`;
    const lista = porDestino.get(chave) ?? [];
    lista.push({ fonteId, row });
    porDestino.set(chave, lista);
  }

  const resultados = new Map<string, ResultadoClassificacao>();

  for (const [chave, items] of porDestino) {
    if (chave.startsWith("area:")) {
      const area = chave.replace("area:", "") as AreaAgregada;
      etapas.push(`Roteamento ${area}: ${items.length} questão(ões)`);
      const parcial = await classificarLoteAreaAgregada(area, items, ctx);
      for (const [k, v] of parcial) resultados.set(k, v);
    } else {
      const materiaId = chave.replace("cat:", "") as MateriaCorpusId;
      etapas.push(`Catálogo ${materiaId}: ${items.length} questão(ões)`);
      const parcial = await classificarLoteMateria(materiaId, items, ctx);
      for (const [k, v] of parcial) resultados.set(k, v);
    }
  }

  const saida = rows.map((row) => {
    const fonteId = chaveQuestaoVariante(row.numero, row.idiomaVariante ?? "COMUM");
    const resultado = resultados.get(fonteId);
    if (!resultado) return row;

    const versao = versaoFromResultado(resultado, row);

    return aplicarResultadoNaRow(row, resultado, versao);
  });

  const classificadas = saida.filter((r) => r.conhecimentoEscopoId).length;
  etapas.push(`N2 aplicado: ${classificadas}/${rows.length} questões`);

  return { rows: saida, avisos, etapas };
}

/** Reclassificação unitária na auditoria — catálogo N2 (substitui taxonomy legada). */
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
}): Promise<QuestaoProvaClassificadaCatalogo> {
  const textoBase = input.trechoEnunciado.trim();
  const textoCatalogo = input.observacoes?.trim()
    ? `${input.observacoes.trim()}\n\n${textoBase}`
    : textoBase;

  const row: ProvaQuestaoRow = {
    numero: input.numero,
    idiomaVariante: input.idiomaVariante ?? "COMUM",
    areaBloco: input.areaBloco ?? undefined,
    materia: input.materia ?? "A classificar",
    assunto: "A classificar",
    enunciado: textoCatalogo,
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
  semTexto: number;
  avisos: string[];
  etapas: string[];
};

function questaoDbParaRow(q: {
  numero: number;
  idiomaVariante: IdiomaVarianteQuestao;
  areaBloco: string | null;
  materia: string;
  assunto: string;
  enunciado: string | null;
  alternativas: string | null;
  observacoes: string | null;
  conhecimentoExigido: string | null;
  nivelDificuldade: string | null;
  gabarito: string | null;
}): ProvaQuestaoRow {
  const texto = q.enunciado?.trim() || q.observacoes?.trim() || "";
  return {
    numero: q.numero,
    idiomaVariante: q.idiomaVariante as ProvaQuestaoRow["idiomaVariante"],
    areaBloco: q.areaBloco ?? undefined,
    materia: q.materia,
    assunto: q.assunto,
    enunciado: texto || undefined,
    alternativas: q.alternativas?.trim() || undefined,
    observacoes: q.observacoes ?? undefined,
    conhecimentoExigido: q.conhecimentoExigido ?? undefined,
    nivelDificuldade: q.nivelDificuldade ?? undefined,
    gabarito: q.gabarito ?? undefined,
  };
}

/**
 * Reclassifica todas as questões já no banco com catálogo N2 — sem reenviar PDF.
 */
export async function reclassificarProvaInteiraComCatalogo(
  provaId: string,
  opts?: { banca?: string | null }
): Promise<ReclassificarProvaInteiraResult> {
  const questoes = await prisma.provaQuestao.findMany({
    where: { provaId },
    orderBy: [{ numero: "asc" }, { idiomaVariante: "asc" }],
  });

  if (questoes.length === 0) {
    return {
      total: 0,
      processadas: 0,
      classificadas: 0,
      semTexto: 0,
      avisos: ["Nenhuma questão no banco."],
      etapas: [],
    };
  }

  const rowsEntrada = questoes.map(questaoDbParaRow);
  const semTexto = rowsEntrada.filter((r) => textoQuestao(r).length < 10).length;

  const { rows, avisos, etapas } = await classificarRowsProvaComCatalogo(rowsEntrada, {
    banca: opts?.banca ?? undefined,
  });

  const atualizadas = await atualizarClassificacaoLote(provaId, rows);
  const classificadas = rows.filter((r) => r.conhecimentoEscopoId).length;

  return {
    total: questoes.length,
    processadas: atualizadas,
    classificadas,
    semTexto,
    avisos,
    etapas,
  };
}

export { CLASSIFICADOR_CATALOGO_V11 } from "@/lib/enem-classificar/classificar-catalogo-v11";
export { CLASSIFICADOR_DISCIPLINA_V10 } from "@/lib/enem-classificar/classificar-roteamento-disciplina";
