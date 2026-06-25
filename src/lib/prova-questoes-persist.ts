import type { IdiomaVarianteQuestao } from "@/generated/prisma/client";
import type { QuestaoExtraida } from "@/lib/ai-extract-prova";
import type { EtapaExtracao } from "@/lib/prova-extracao-pipeline";
import type { ProvaQuestaoRow } from "@/lib/parse-prova-csv";
import { prisma } from "@/lib/prisma";
import {
  atribuirOrdemExtracaoSequencial,
  chaveOrdemExtracao,
  compararPorOrdemExtracao,
} from "@/lib/prova-questao-ordem";
import { normalizarLabelAssunto, normalizarLabelMateria } from "@/lib/taxonomia-validacao";
import { normalizarAreaBloco } from "@/lib/areas-bloco";
import { normalizarGabaritoOficial } from "@/lib/gabarito-anulada";
import {
  sanitizarTextoProva,
  truncarTextoProva,
  observacaoComExtracaoAceita,
  observacaoSemMarcadorExtracao,
} from "@/lib/prova-texto-prova";

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

function rowParaCreate(provaId: string, r: ProvaQuestaoRow, ordemExtracao: number) {
  return {
    provaId,
    ordemExtracao,
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
    conhecimentoEscopoId: r.conhecimentoEscopoId ?? null,
    conhecimentoDominioId: r.conhecimentoDominioId ?? null,
    classificacaoVersao: r.classificacaoVersao ?? null,
    classificacaoConfianca: r.classificacaoConfianca ?? null,
    classificacaoSecundariosJson: r.classificacaoSecundariosJson ?? null,
    conceitosCanonicosJson: r.conceitosCanonicosJson ?? null,
  };
}

function normalizarRows(rows: ProvaQuestaoRow[]): ProvaQuestaoRow[] {
  return rows.map((r) => {
    const materia = normalizarLabelMateria(r.materia);
    return {
      ordemExtracao: r.ordemExtracao,
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

export function montarTextoFonteDeRows(rows: ProvaQuestaoRow[]): string {
  const sorted = [...rows].sort(compararPorOrdemExtracao);
  const partes: string[] = [];
  for (const r of sorted) {
    const ordem = r.ordemExtracao ?? "?";
    const bloco: string[] = [`=== Ordem ${ordem} · Questão ${r.numero} ===`];
    if (r.enunciado?.trim()) bloco.push(r.enunciado.trim());
    if (r.alternativas?.trim()) bloco.push(r.alternativas.trim());
    if (bloco.length > 1) partes.push(bloco.join("\n"));
  }
  return partes.join("\n\n").trim();
}

export async function persistirTextoFonteProva(provaId: string, texto: string): Promise<void> {
  const t = texto.trim();
  if (t.length < 50) return;
  await prisma.prova.update({
    where: { id: provaId },
    data: { textoFonte: t.slice(0, 500_000) },
  });
}

export async function persistirQuestoesClassificadas(
  provaId: string,
  rows: ProvaQuestaoRow[],
  opts?: { substituir?: boolean }
): Promise<number> {
  const substituir = opts?.substituir !== false;
  const normalizadas = atribuirOrdemExtracaoSequencial(normalizarRows(rows));
  if (normalizadas.length === 0) return 0;

  if (substituir) {
    await prisma.$transaction([
      prisma.provaQuestao.deleteMany({ where: { provaId } }),
      prisma.provaQuestao.createMany({
        data: normalizadas.map((r) => rowParaCreate(provaId, r, r.ordemExtracao!)),
      }),
    ]);
    return normalizadas.length;
  }

  let n = 0;
  for (const r of normalizadas) {
    const ordem = r.ordemExtracao!;
    await prisma.provaQuestao.upsert({
      where: { provaId_ordemExtracao: { provaId, ordemExtracao: ordem } },
      create: rowParaCreate(provaId, r, ordem),
      update: {
        numero: r.numero,
        areaBloco: r.areaBloco ?? null,
        materia: r.materia,
        assunto: r.assunto,
        conhecimentoExigido: r.conhecimentoExigido ?? null,
        nivelDificuldade: r.nivelDificuldade ?? null,
        observacoes: r.observacoes ?? null,
        ...(r.enunciado ? { enunciado: truncarEnunciado(r.enunciado) } : {}),
        ...(r.alternativas ? { alternativas: truncarAlternativas(r.alternativas) } : {}),
        ...(r.gabarito ? { gabarito: r.gabarito } : {}),
        conhecimentoEscopoId: r.conhecimentoEscopoId ?? null,
        conhecimentoDominioId: r.conhecimentoDominioId ?? null,
        classificacaoVersao: r.classificacaoVersao ?? null,
        classificacaoConfianca: r.classificacaoConfianca ?? null,
        classificacaoSecundariosJson: r.classificacaoSecundariosJson ?? null,
        conceitosCanonicosJson: r.conceitosCanonicosJson ?? null,
      },
    });
    n++;
  }
  return n;
}

export async function persistirQuestoesExtracaoProva(
  provaId: string,
  rows: ProvaQuestaoRow[],
  opts?: { substituir?: boolean }
): Promise<number> {
  const substituir = opts?.substituir !== false;
  const limpas = rows
    .filter((r) => r.ordemExtracao != null && r.ordemExtracao > 0)
    .map((r) => ({
      ...r,
      areaBloco: undefined,
      materia: "A classificar",
      assunto: "A classificar",
      idiomaVariante: "COMUM" as const,
      conhecimentoExigido: undefined,
      conhecimentoEscopoId: null,
      conhecimentoDominioId: null,
      classificacaoVersao: null,
      classificacaoConfianca: null,
      classificacaoSecundariosJson: null,
      conceitosCanonicosJson: null,
    }));

  if (limpas.length === 0) {
    throw new Error("Nenhuma linha com ordemExtracao válida para gravar.");
  }

  const ordens = limpas.map((r) => r.ordemExtracao!);
  if (new Set(ordens).size !== ordens.length) {
    throw new Error("Ordens de extração duplicadas — reexecute o pipeline.");
  }

  await prisma.prova.update({
    where: { id: provaId },
    data: { extracaoValidada: false },
  });

  const data = limpas.map((r) => ({
    ...rowParaCreate(provaId, r, r.ordemExtracao!),
    classificacaoN1Json: null,
  }));

  if (substituir) {
    await prisma.$transaction([
      prisma.provaQuestao.deleteMany({ where: { provaId } }),
      prisma.provaQuestao.createMany({ data }),
    ]);
    return data.length;
  }

  let n = 0;
  for (const row of data) {
    await prisma.provaQuestao.upsert({
      where: {
        provaId_ordemExtracao: {
          provaId,
          ordemExtracao: row.ordemExtracao,
        },
      },
      create: row,
      update: {
        numero: row.numero,
        enunciado: row.enunciado,
        alternativas: row.alternativas,
        materia: row.materia,
        assunto: row.assunto,
        areaBloco: null,
        conhecimentoExigido: null,
        conhecimentoEscopoId: null,
        conhecimentoDominioId: null,
        classificacaoVersao: null,
        classificacaoConfianca: null,
        classificacaoSecundariosJson: null,
        conceitosCanonicosJson: null,
        classificacaoN1Json: null,
        observacoes: row.observacoes,
      },
    });
    n++;
  }
  return n;
}

export async function atualizarQuestaoExtracaoManual(
  provaId: string,
  input: {
    questaoId: string;
    enunciado: string;
    alternativas?: string | null;
  }
): Promise<{ id: string }> {
  const enunciado = truncarEnunciado(input.enunciado);
  if (!enunciado || enunciado.length < 10) {
    throw new Error("Enunciado muito curto.");
  }

  const existente = await prisma.provaQuestao.findFirst({
    where: { id: input.questaoId, provaId },
    select: { id: true, observacoes: true },
  });
  if (!existente) {
    throw new Error("Linha não encontrada.");
  }

  const row = await prisma.provaQuestao.update({
    where: { id: existente.id },
    data: {
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
      classificacaoN1Json: null,
      observacoes: observacaoSemMarcadorExtracao(existente.observacoes),
    },
  });

  await prisma.prova.update({
    where: { id: provaId },
    data: { extracaoValidada: false },
  });

  return { id: row.id };
}

export async function upsertQuestaoExtracaoManual(
  provaId: string,
  input: {
    questaoId?: string;
    enunciado: string;
    alternativas?: string | null;
  }
): Promise<{ id: string }> {
  if (!input.questaoId) {
    throw new Error("Informe questaoId para corrigir uma linha da extração.");
  }
  return atualizarQuestaoExtracaoManual(provaId, input as { questaoId: string; enunciado: string; alternativas?: string | null });
}

export async function aceitarEnunciadoExtracaoProva(
  provaId: string,
  input: { questaoId: string }
): Promise<{ id: string }> {
  const existente = await prisma.provaQuestao.findFirst({
    where: { id: input.questaoId, provaId },
  });
  if (!existente) {
    throw new Error("Linha não encontrada no banco.");
  }
  if (!existente.enunciado?.trim()) {
    throw new Error("Linha sem enunciado — cole o texto antes de aceitar.");
  }

  const row = await prisma.provaQuestao.update({
    where: { id: existente.id },
    data: {
      observacoes: observacaoComExtracaoAceita(existente.observacoes),
    },
  });

  return { id: row.id };
}

const ENUNCIADO_MIN_RECLASSIFICAR = 80;

export async function atualizarClassificacaoLote(
  provaId: string,
  rows: ProvaQuestaoRow[]
): Promise<number> {
  let n = 0;
  for (const r of rows) {
    if (!r.ordemExtracao) continue;
    const existente = await prisma.provaQuestao.findUnique({
      where: {
        provaId_ordemExtracao: { provaId, ordemExtracao: r.ordemExtracao },
      },
      select: { id: true },
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
        conhecimentoEscopoId: r.conhecimentoEscopoId ?? null,
        conhecimentoDominioId: r.conhecimentoDominioId ?? null,
        classificacaoVersao: r.classificacaoVersao ?? null,
        classificacaoConfianca: r.classificacaoConfianca ?? null,
        classificacaoSecundariosJson: r.classificacaoSecundariosJson ?? null,
        conceitosCanonicosJson: r.conceitosCanonicosJson ?? null,
      },
    });
    n++;
  }
  return n;
}

type QuestaoComN2 = QuestaoExtraida & {
  ordemExtracao?: number;
  idiomaVariante?: IdiomaVarianteQuestao;
  conhecimentoEscopoId?: string | null;
  conhecimentoDominioId?: string | null;
  classificacaoVersao?: string | null;
  classificacaoConfianca?: number | null;
  classificacaoSecundariosJson?: string | null;
  conceitosCanonicosJson?: string | null;
};

export async function upsertQuestoesExtraidas(
  provaId: string,
  questoes: QuestaoComN2[],
  idiomaVariantePadrao: IdiomaVarianteQuestao = "COMUM"
): Promise<number> {
  let n = 0;
  for (let i = 0; i < questoes.length; i++) {
    const q = questoes[i]!;
    const ordem = q.ordemExtracao ?? i + 1;
    const variante = q.idiomaVariante ?? idiomaVariantePadrao;
    await prisma.provaQuestao.upsert({
      where: { provaId_ordemExtracao: { provaId, ordemExtracao: ordem } },
      create: {
        provaId,
        ordemExtracao: ordem,
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
        conhecimentoEscopoId: q.conhecimentoEscopoId ?? null,
        conhecimentoDominioId: q.conhecimentoDominioId ?? null,
        classificacaoVersao: q.classificacaoVersao ?? null,
        classificacaoConfianca: q.classificacaoConfianca ?? null,
        classificacaoSecundariosJson: q.classificacaoSecundariosJson ?? null,
        conceitosCanonicosJson: q.conceitosCanonicosJson ?? null,
      },
      update: {
        numero: q.numero,
        areaBloco: q.areaBloco ?? null,
        materia: q.materia,
        assunto: q.assunto,
        conhecimentoExigido: q.conhecimentoExigido ?? null,
        nivelDificuldade: q.nivelDificuldade ?? null,
        observacoes: q.observacoes ?? null,
        enunciado: truncarEnunciado(q.trechoEnunciado),
        conhecimentoEscopoId: q.conhecimentoEscopoId ?? null,
        conhecimentoDominioId: q.conhecimentoDominioId ?? null,
        classificacaoVersao: q.classificacaoVersao ?? null,
        classificacaoConfianca: q.classificacaoConfianca ?? null,
        classificacaoSecundariosJson: q.classificacaoSecundariosJson ?? null,
        conceitosCanonicosJson: q.conceitosCanonicosJson ?? null,
      },
    });
    n++;
  }
  return n;
}

export async function atualizarQuestoesPorEtapa(
  provaId: string,
  questoes: QuestaoExtraida[],
  etapa: EtapaExtracao
): Promise<number> {
  let n = 0;
  for (let i = 0; i < questoes.length; i++) {
    const q = questoes[i]!;
    const ordem = (q as QuestaoComN2).ordemExtracao ?? i + 1;
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
      where: { provaId_ordemExtracao: { provaId, ordemExtracao: ordem } },
      create: {
        provaId,
        ordemExtracao: ordem,
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
    data: questoes.map((q, i) => ({
      provaId,
      ordemExtracao: (q as QuestaoComN2).ordemExtracao ?? i + 1,
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

export function chaveObservacaoQuestao(r: { ordemExtracao?: number | null }): string {
  if (r.ordemExtracao == null) return "ordem:?";
  return chaveOrdemExtracao(r.ordemExtracao);
}
