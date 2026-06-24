import type { IdiomaVarianteQuestao } from "@/generated/prisma/client";
import type { QuestaoExtraida } from "@/lib/ai-extract-prova";
import type { EtapaExtracao } from "@/lib/prova-extracao-pipeline";
import type { ProvaQuestaoRow } from "@/lib/parse-prova-csv";
import { prisma } from "@/lib/prisma";
import { chaveQuestaoVariante } from "@/lib/prova-idioma";
import { normalizarLabelAssunto, normalizarLabelMateria } from "@/lib/taxonomia-validacao";
import { normalizarAreaBloco } from "@/lib/areas-bloco";
import { normalizarGabaritoOficial } from "@/lib/gabarito-anulada";
import { sanitizarTextoProva, truncarTextoProva, observacaoComExtracaoAceita, observacaoSemMarcadorExtracao } from "@/lib/prova-texto-prova";

function truncarEnunciado(t?: string | null): string | null {
  if (!t?.trim()) return null;
  return truncarTextoProva(sanitizarTextoProva(t));
}

function truncarAlternativas(t?: string | null): string | null {
  if (!t?.trim()) return null;
  return truncarTextoProva(sanitizarTextoProva(t), 8000);
}

function varianteRow(r: ProvaQuestaoRow): IdiomaVarianteQuestao {
  return (r.idiomaVariante ?? "COMUM") as IdiomaVarianteQuestao;
}

function varianteExtraida(q: QuestaoExtraida & { idiomaVariante?: IdiomaVarianteQuestao }): IdiomaVarianteQuestao {
  return (q.idiomaVariante ?? "COMUM") as IdiomaVarianteQuestao;
}

function whereVariante(provaId: string, numero: number, variante: IdiomaVarianteQuestao) {
  return {
    provaId_numero_idiomaVariante: { provaId, numero, idiomaVariante: variante },
  };
}

function filtroVariante(provaId: string, numero: number, variante: IdiomaVarianteQuestao) {
  return { provaId, numero, idiomaVariante: variante };
}

/** Normaliza rótulos para exibição — sem reclassificar matéria/assunto por regex legado. */
function normalizarRows(rows: ProvaQuestaoRow[]): ProvaQuestaoRow[] {
  return rows.map((r) => {
    const materia = normalizarLabelMateria(r.materia);
    return {
      numero: r.numero,
      idiomaVariante: varianteRow(r),
      areaBloco: normalizarAreaBloco(r.areaBloco, materia) ?? undefined,
      materia,
      assunto: normalizarLabelAssunto(materia, r.assunto),
      conhecimentoExigido: r.conhecimentoExigido?.trim() || undefined,
      nivelDificuldade: r.nivelDificuldade?.trim() || undefined,
      observacoes: r.observacoes?.trim() || undefined,
      enunciado: r.enunciado?.trim() || undefined,
      alternativas: r.alternativas?.trim() || undefined,
      gabarito: normalizarGabaritoOficial(r.gabarito) ?? undefined,
      conhecimentoEscopoId: r.conhecimentoEscopoId,
      conhecimentoDominioId: r.conhecimentoDominioId,
      classificacaoVersao: r.classificacaoVersao,
      classificacaoConfianca: r.classificacaoConfianca,
      classificacaoSecundariosJson: r.classificacaoSecundariosJson,
      conceitosCanonicosJson: r.conceitosCanonicosJson,
    };
  });
}

function camposN2(r: ProvaQuestaoRow) {
  return {
    conhecimentoEscopoId: r.conhecimentoEscopoId ?? null,
    conhecimentoDominioId: r.conhecimentoDominioId ?? null,
    classificacaoVersao: r.classificacaoVersao ?? null,
    classificacaoConfianca: r.classificacaoConfianca ?? null,
    classificacaoSecundariosJson: r.classificacaoSecundariosJson ?? null,
    conceitosCanonicosJson: r.conceitosCanonicosJson ?? null,
  };
}

/** Grava classificação no banco (pipeline PDF ou CSV do ChatGPT). */
export async function persistirQuestoesClassificadas(
  provaId: string,
  rows: ProvaQuestaoRow[],
  opts?: { substituir?: boolean }
): Promise<number> {
  const substituir = opts?.substituir !== false;
  const normalizadas = normalizarRows(rows);
  if (normalizadas.length === 0) return 0;

  if (substituir) {
    await prisma.$transaction([
      prisma.provaQuestao.deleteMany({ where: { provaId } }),
      prisma.provaQuestao.createMany({
        data: normalizadas.map((r) => ({
          provaId,
          numero: r.numero,
          idiomaVariante: varianteRow(r),
          areaBloco: r.areaBloco ?? null,
          materia: r.materia,
          assunto: r.assunto,
          conhecimentoExigido: r.conhecimentoExigido ?? null,
          nivelDificuldade: r.nivelDificuldade ?? null,
          observacoes: r.observacoes ?? null,
          enunciado: truncarEnunciado(r.enunciado),
          alternativas: truncarAlternativas(r.alternativas),
          gabarito: r.gabarito ?? null,
          ...camposN2(r),
        })),
      }),
    ]);
    return normalizadas.length;
  }

  let n = 0;
  for (const r of normalizadas) {
    const variante = varianteRow(r);
    await prisma.provaQuestao.upsert({
      where: whereVariante(provaId, r.numero, variante),
      create: {
        provaId,
        numero: r.numero,
        idiomaVariante: variante,
        areaBloco: r.areaBloco ?? null,
        materia: r.materia,
        assunto: r.assunto,
        conhecimentoExigido: r.conhecimentoExigido ?? null,
        nivelDificuldade: r.nivelDificuldade ?? null,
        observacoes: r.observacoes ?? null,
        enunciado: truncarEnunciado(r.enunciado),
        alternativas: truncarAlternativas(r.alternativas),
        gabarito: r.gabarito ?? null,
        ...camposN2(r),
      },
      update: {
        areaBloco: r.areaBloco ?? null,
        materia: r.materia,
        assunto: r.assunto,
        conhecimentoExigido: r.conhecimentoExigido ?? null,
        nivelDificuldade: r.nivelDificuldade ?? null,
        observacoes: r.observacoes ?? null,
        ...(r.enunciado ? { enunciado: truncarEnunciado(r.enunciado) } : {}),
        ...(r.alternativas ? { alternativas: truncarAlternativas(r.alternativas) } : {}),
        ...(r.gabarito ? { gabarito: r.gabarito } : {}),
        ...camposN2(r),
      },
    });
    n++;
  }
  return n;
}

/** Grava só extração (enunciado/alternativas/área) — limpa classificação anterior. */
export async function persistirQuestoesExtracaoProva(
  provaId: string,
  rows: ProvaQuestaoRow[],
  opts?: { substituir?: boolean }
): Promise<number> {
  const limpas = rows.map((r) => ({
    ...r,
    materia: "A classificar",
    assunto: "A classificar",
    conhecimentoExigido: undefined,
    conhecimentoEscopoId: null,
    conhecimentoDominioId: null,
    classificacaoVersao: null,
    classificacaoConfianca: null,
    classificacaoSecundariosJson: null,
    conceitosCanonicosJson: null,
  }));

  await prisma.prova.update({
    where: { id: provaId },
    data: { extracaoValidada: false },
  });

  return persistirQuestoesClassificadas(provaId, limpas, opts);
}

/** Correção manual ou inclusão de questão faltante na validação. */
export async function upsertQuestaoExtracaoManual(
  provaId: string,
  input: {
    numero: number;
    idiomaVariante?: IdiomaVarianteQuestao;
    enunciado: string;
    alternativas?: string | null;
    areaBloco?: string | null;
  }
): Promise<{ id: string }> {
  const variante = (input.idiomaVariante ?? "COMUM") as IdiomaVarianteQuestao;
  const enunciado = truncarEnunciado(input.enunciado);
  if (!enunciado || enunciado.length < 10) {
    throw new Error("Enunciado muito curto.");
  }

  const anterior = await prisma.provaQuestao.findFirst({
    where: filtroVariante(provaId, input.numero, variante),
    select: { observacoes: true },
  });

  const row = await prisma.provaQuestao.upsert({
    where: whereVariante(provaId, input.numero, variante),
    create: {
      provaId,
      numero: input.numero,
      idiomaVariante: variante,
      areaBloco: input.areaBloco ?? null,
      materia: "A classificar",
      assunto: "A classificar",
      enunciado,
      alternativas: truncarAlternativas(input.alternativas),
      gabarito: null,
    },
    update: {
      areaBloco: input.areaBloco ?? undefined,
      enunciado,
      alternativas: truncarAlternativas(input.alternativas),
      materia: "A classificar",
      assunto: "A classificar",
      conhecimentoExigido: null,
      conhecimentoEscopoId: null,
      conhecimentoDominioId: null,
      classificacaoVersao: null,
      classificacaoConfianca: null,
      classificacaoSecundariosJson: null,
      conceitosCanonicosJson: null,
      observacoes: observacaoSemMarcadorExtracao(anterior?.observacoes),
    },
  });

  await prisma.prova.update({
    where: { id: provaId },
    data: { extracaoValidada: false },
  });

  return { id: row.id };
}

/** Admin confirmou que enunciado curto está completo (ex.: matemática direta). */
export async function aceitarEnunciadoExtracaoProva(
  provaId: string,
  input: { numero: number; idiomaVariante?: IdiomaVarianteQuestao }
): Promise<{ id: string }> {
  const variante = (input.idiomaVariante ?? "COMUM") as IdiomaVarianteQuestao;
  const existente = await prisma.provaQuestao.findFirst({
    where: filtroVariante(provaId, input.numero, variante),
  });
  if (!existente) {
    throw new Error("Questão não encontrada no banco.");
  }
  if (!existente.enunciado?.trim()) {
    throw new Error("Questão sem enunciado — cole o texto antes de aceitar.");
  }

  const row = await prisma.provaQuestao.update({
    where: { id: existente.id },
    data: {
      observacoes: observacaoComExtracaoAceita(existente.observacoes),
    },
  });

  await prisma.prova.update({
    where: { id: provaId },
    data: { extracaoValidada: false },
  });

  return { id: row.id };
}

const ENUNCIADO_MIN_RECLASSIFICAR = 80;

/** Atualiza classificação N2 + rótulos legados sem apagar enunciado/gabarito existentes. */
export async function atualizarClassificacaoLote(
  provaId: string,
  rows: ProvaQuestaoRow[]
): Promise<number> {
  let n = 0;
  for (const r of rows) {
    const variante = varianteRow(r);
    const existente = await prisma.provaQuestao.findUnique({
      where: whereVariante(provaId, r.numero, variante),
      select: { id: true, enunciado: true, gabarito: true },
    });
    if (!existente) continue;

    await prisma.provaQuestao.update({
      where: { id: existente.id },
      data: {
        areaBloco: r.areaBloco ?? null,
        materia: r.materia,
        assunto: r.assunto,
        conhecimentoExigido: r.conhecimentoExigido ?? null,
        nivelDificuldade: r.nivelDificuldade ?? null,
        ...(r.enunciado && r.enunciado.trim().length >= ENUNCIADO_MIN_RECLASSIFICAR
          ? { enunciado: truncarEnunciado(r.enunciado) }
          : {}),
        ...camposN2(r),
      },
    });
    n++;
  }
  return n;
}

type QuestaoComN2 = QuestaoExtraida & {
  idiomaVariante?: IdiomaVarianteQuestao;
  conhecimentoEscopoId?: string | null;
  conhecimentoDominioId?: string | null;
  classificacaoVersao?: string | null;
  classificacaoConfianca?: number | null;
  classificacaoSecundariosJson?: string | null;
  conceitosCanonicosJson?: string | null;
};

function camposN2Questao(q: QuestaoComN2) {
  return {
    conhecimentoEscopoId: q.conhecimentoEscopoId ?? null,
    conhecimentoDominioId: q.conhecimentoDominioId ?? null,
    classificacaoVersao: q.classificacaoVersao ?? null,
    classificacaoConfianca: q.classificacaoConfianca ?? null,
    classificacaoSecundariosJson: q.classificacaoSecundariosJson ?? null,
    conceitosCanonicosJson: q.conceitosCanonicosJson ?? null,
  };
}

export async function upsertQuestoesExtraidas(
  provaId: string,
  questoes: QuestaoComN2[],
  idiomaVariantePadrao: IdiomaVarianteQuestao = "COMUM"
): Promise<number> {
  let n = 0;
  for (const q of questoes) {
    const variante = q.idiomaVariante ?? idiomaVariantePadrao;
    await prisma.provaQuestao.upsert({
      where: whereVariante(provaId, q.numero, variante),
      create: {
        provaId,
        numero: q.numero,
        idiomaVariante: variante,
        areaBloco: q.areaBloco ?? null,
        materia: q.materia,
        assunto: q.assunto,
        conhecimentoExigido: q.conhecimentoExigido ?? null,
        nivelDificuldade: q.nivelDificuldade ?? null,
        observacoes: q.observacoes ?? null,
        enunciado: truncarEnunciado(q.trechoEnunciado),
        gabarito: null,
        ...camposN2Questao(q),
      },
      update: {
        areaBloco: q.areaBloco ?? null,
        materia: q.materia,
        assunto: q.assunto,
        conhecimentoExigido: q.conhecimentoExigido ?? null,
        nivelDificuldade: q.nivelDificuldade ?? null,
        observacoes: q.observacoes ?? null,
        enunciado: truncarEnunciado(q.trechoEnunciado),
        ...camposN2Questao(q),
      },
    });
    n++;
  }
  return n;
}

/** Atualiza só os campos da etapa escolhida (enunciados já gravados no banco). */
export async function atualizarQuestoesPorEtapa(
  provaId: string,
  questoes: QuestaoExtraida[],
  etapa: EtapaExtracao
): Promise<number> {
  let n = 0;
  for (const q of questoes) {
    const enunciado = truncarEnunciado(q.trechoEnunciado);
    const update: Record<string, unknown> = {};

    if (etapa === "enunciados") {
      update.enunciado = enunciado;
      update.materia = "A classificar";
      update.assunto = "A classificar";
      update.conhecimentoExigido = null;
    } else if (etapa === "materia") {
      update.materia = q.materia;
      update.assunto = q.assunto;
      update.areaBloco = q.areaBloco ?? null;
      if (enunciado) update.enunciado = enunciado;
    } else if (etapa === "assunto") {
      update.assunto = q.assunto;
      if (q.materia && q.materia !== "A classificar") update.materia = q.materia;
    } else if (etapa === "conhecimento") {
      update.conhecimentoExigido = q.conhecimentoExigido ?? null;
    } else {
      update.areaBloco = q.areaBloco ?? null;
      update.materia = q.materia;
      update.assunto = q.assunto;
      update.conhecimentoExigido = q.conhecimentoExigido ?? null;
      update.nivelDificuldade = q.nivelDificuldade ?? null;
      update.observacoes = q.observacoes ?? null;
      update.enunciado = enunciado;
    }

    const variante = varianteExtraida(q);
    await prisma.provaQuestao.upsert({
      where: whereVariante(provaId, q.numero, variante),
      create: {
        provaId,
        numero: q.numero,
        idiomaVariante: variante,
        areaBloco: (update.areaBloco as string | null) ?? q.areaBloco ?? null,
        materia: (update.materia as string) ?? q.materia,
        assunto: (update.assunto as string) ?? q.assunto,
        conhecimentoExigido: (update.conhecimentoExigido as string | null) ?? null,
        nivelDificuldade: q.nivelDificuldade ?? null,
        observacoes: q.observacoes ?? null,
        enunciado: (update.enunciado as string | null) ?? enunciado,
        gabarito: null,
      },
      update,
    });
    n++;
  }
  return n;
}

export async function substituirQuestoesExtraidas(
  provaId: string,
  questoes: QuestaoExtraida[]
): Promise<void> {
  await prisma.provaQuestao.deleteMany({ where: { provaId } });
  if (questoes.length === 0) return;
  await prisma.provaQuestao.createMany({
    data: questoes.map((q) => ({
      provaId,
      numero: q.numero,
      idiomaVariante: varianteExtraida(q),
      areaBloco: q.areaBloco ?? null,
      materia: q.materia,
      assunto: q.assunto,
      conhecimentoExigido: q.conhecimentoExigido ?? null,
      nivelDificuldade: q.nivelDificuldade ?? null,
      observacoes: q.observacoes ?? null,
      enunciado: truncarEnunciado(q.trechoEnunciado),
      gabarito: null,
    })),
  });
}

/** Chave estável para preservar observações humanas no re-pipeline. */
export function chaveObservacaoQuestao(r: { numero: number; idiomaVariante?: string }): string {
  return chaveQuestaoVariante(r.numero, r.idiomaVariante ?? "COMUM");
}
