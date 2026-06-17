import type { IdiomaVarianteQuestao } from "@/generated/prisma/client";
import type { QuestaoExtraida } from "@/lib/ai-extract-prova";
import type { EtapaExtracao } from "@/lib/prova-extracao-pipeline";
import type { ProvaQuestaoRow } from "@/lib/parse-prova-csv";
import { prisma } from "@/lib/prisma";
import { chaveQuestaoVariante } from "@/lib/prova-idioma";
import {
  alinharLoteTaxonomia,
  normalizarLabelAssunto,
  normalizarLabelMateria,
} from "@/lib/taxonomia-validacao";
import { normalizarAreaBloco } from "@/lib/areas-bloco";
import { normalizarGabaritoOficial } from "@/lib/gabarito-anulada";

function truncarEnunciado(t?: string | null): string | null {
  if (!t?.trim()) return null;
  const s = t.trim();
  return s.length > 6000 ? `${s.slice(0, 6000)}…` : s;
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

function normalizarRows(rows: ProvaQuestaoRow[]): ProvaQuestaoRow[] {
  const base = rows.map((r) => {
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
    gabarito: normalizarGabaritoOficial(r.gabarito) ?? undefined,
    };
  });

  const alinhadas = alinharLoteTaxonomia(
    base.map((r) => ({
      numero: r.numero,
      trechoEnunciado: r.enunciado ?? "",
      materia: r.materia,
      assunto: r.assunto,
      areaBloco: r.areaBloco ?? null,
      conhecimentoExigido: r.conhecimentoExigido ?? null,
      nivelDificuldade: r.nivelDificuldade ?? null,
      observacoes: r.observacoes ?? null,
    }))
  );

  return alinhadas.questoes.map((q, i) => ({
    ...base[i],
    materia: q.materia,
    assunto: q.assunto,
    areaBloco:
      normalizarAreaBloco(q.areaBloco ?? base[i].areaBloco, q.materia) ?? undefined,
    conhecimentoExigido: q.conhecimentoExigido ?? undefined,
  }));
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
          gabarito: r.gabarito ?? null,
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
        gabarito: r.gabarito ?? null,
      },
      update: {
        areaBloco: r.areaBloco ?? null,
        materia: r.materia,
        assunto: r.assunto,
        conhecimentoExigido: r.conhecimentoExigido ?? null,
        nivelDificuldade: r.nivelDificuldade ?? null,
        observacoes: r.observacoes ?? null,
        ...(r.enunciado ? { enunciado: truncarEnunciado(r.enunciado) } : {}),
        ...(r.gabarito ? { gabarito: r.gabarito } : {}),
      },
    });
    n++;
  }
  return n;
}

export async function upsertQuestoesExtraidas(
  provaId: string,
  questoes: (QuestaoExtraida & { idiomaVariante?: IdiomaVarianteQuestao })[],
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
      },
      update: {
        areaBloco: q.areaBloco ?? null,
        materia: q.materia,
        assunto: q.assunto,
        conhecimentoExigido: q.conhecimentoExigido ?? null,
        nivelDificuldade: q.nivelDificuldade ?? null,
        observacoes: q.observacoes ?? null,
        enunciado: truncarEnunciado(q.trechoEnunciado),
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
