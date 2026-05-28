/**
 * Remove camada derivada do copiloto (plano, quests, anamnese opcional).
 * Mantém: User, Exam, QuestionAttempt, Prova, XP, logs emocionais, snapshots por prova.
 */
import { prisma } from "@/lib/prisma";

export type ZerarCopilotoOptions = {
  /** Apaga anamnese para refazer "Entendendo sua jornada" */
  incluirAnamnese?: boolean;
};

export type ZerarCopilotoResult = {
  questsRemovidas: number;
  planosRemovidos: number;
  anamneseRemovida: boolean;
};

/** Apaga planos e quests acumulados (fonte comum de duplicata / lixo). */
export async function zerarDerivadosCopiloto(
  userId: string,
  opts: ZerarCopilotoOptions = {}
): Promise<ZerarCopilotoResult> {
  const [quests, planos] = await Promise.all([
    prisma.quest.deleteMany({ where: { userId } }),
    prisma.studyPlan.deleteMany({ where: { userId } }),
  ]);

  let anamneseRemovida = false;
  if (opts.incluirAnamnese) {
    const r = await prisma.studentAnamnesis.deleteMany({ where: { userId } });
    anamneseRemovida = r.count > 0;
  }

  return {
    questsRemovidas: quests.count,
    planosRemovidos: planos.count,
    anamneseRemovida,
  };
}

/** Zera derivados e recria plano global + quests pelo motor atual. */
export async function recriarCopilotoDoZero(
  userId: string,
  opts: ZerarCopilotoOptions = {}
): Promise<ZerarCopilotoResult> {
  const limpeza = await zerarDerivadosCopiloto(userId, opts);
  const { regenerarPlanoGlobalUsuario } = await import("@/lib/prova-attempt");
  await regenerarPlanoGlobalUsuario(userId, { pularLimpeza: true });
  return limpeza;
}
