import type { QuestaoExtraida } from "@/lib/ai-extract-prova";
import { prisma } from "@/lib/prisma";

function truncarEnunciado(t?: string | null): string | null {
  if (!t?.trim()) return null;
  const s = t.trim();
  return s.length > 2000 ? `${s.slice(0, 2000)}…` : s;
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
