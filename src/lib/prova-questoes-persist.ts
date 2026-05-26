import type { QuestaoExtraida } from "@/lib/ai-extract-prova";
import type { EtapaExtracao } from "@/lib/prova-extracao-pipeline";
import { prisma } from "@/lib/prisma";

function truncarEnunciado(t?: string | null): string | null {
  if (!t?.trim()) return null;
  const s = t.trim();
  // Enunciado completo é base para classificação/pós-correção (auditoria e reclassificar).
  // Mantemos um limite alto para não cortar "comando + alternativas" em questões longas.
  return s.length > 6000 ? `${s.slice(0, 6000)}…` : s;
}

export async function upsertQuestoesExtraidas(
  provaId: string,
  questoes: QuestaoExtraida[]
): Promise<number> {
  let n = 0;
  for (const q of questoes) {
    await prisma.provaQuestao.upsert({
      where: { provaId_numero: { provaId, numero: q.numero } },
      create: {
        provaId,
        numero: q.numero,
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

    await prisma.provaQuestao.upsert({
      where: { provaId_numero: { provaId, numero: q.numero } },
      create: {
        provaId,
        numero: q.numero,
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
