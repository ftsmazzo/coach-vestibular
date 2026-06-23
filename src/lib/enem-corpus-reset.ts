import type { PrismaClient } from "@/generated/prisma/client";

export type ZerarCorpusResultado = {
  removidas: number;
};

/** Apaga todo o corpus ENEM — estrutura e classificações N2. Irreversível. */
export async function zerarCorpusEnem(prisma: PrismaClient): Promise<ZerarCorpusResultado> {
  const antes = await prisma.enemQuestaoCorpus.count();
  if (antes === 0) {
    return { removidas: 0 };
  }

  const { count } = await prisma.enemQuestaoCorpus.deleteMany({});
  return { removidas: count };
}
