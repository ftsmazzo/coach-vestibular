import type { QuestaoExtraida } from "@/lib/ai-extract-prova";
import { prisma } from "@/lib/prisma";

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
        gabarito: null,
      },
      update: {
        areaBloco: q.areaBloco ?? null,
        materia: q.materia,
        assunto: q.assunto,
        conhecimentoExigido: q.conhecimentoExigido ?? null,
        nivelDificuldade: q.nivelDificuldade ?? null,
        observacoes: q.observacoes ?? null,
      },
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
      gabarito: null,
    })),
  });
}
