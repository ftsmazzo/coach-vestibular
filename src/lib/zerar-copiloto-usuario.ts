/**
 * Remove camada derivada do copiloto (plano, quests, anamnese opcional).
 * Mantém: User, Exam, QuestionAttempt, Prova, XP, logs emocionais, snapshots por prova.
 */
import { prisma } from "@/lib/prisma";
import type { RegenerarPlanoResult } from "@/lib/prova-attempt";

export type ZerarCopilotoOptions = {
  /** Apaga anamnese para refazer "Entendendo sua jornada" */
  incluirAnamnese?: boolean;
};

export type ZerarCopilotoResult = {
  questsRemovidas: number;
  planosRemovidos: number;
  anamneseRemovida: boolean;
};

export type RecriarCopilotoResult = ZerarCopilotoResult & {
  regenerado: RegenerarPlanoResult;
  questsAindaPendentes: number;
  planoGeradoEm: string | null;
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
): Promise<RecriarCopilotoResult> {
  const limpeza = await zerarDerivadosCopiloto(userId, opts);

  const restantesAntes = await prisma.quest.count({
    where: { userId, status: "pending" },
  });
  if (restantesAntes > 0) {
    await prisma.quest.deleteMany({ where: { userId } });
  }

  const { regenerarPlanoGlobalUsuario } = await import("@/lib/prova-attempt");
  const regenerado = await regenerarPlanoGlobalUsuario(userId, { pularLimpeza: true });

  const [questsPendentes, plano] = await Promise.all([
    prisma.quest.count({ where: { userId, status: "pending" } }),
    prisma.studyPlan.findFirst({
      where: { userId, escopo: "GLOBAL" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  return {
    ...limpeza,
    regenerado,
    questsAindaPendentes: questsPendentes,
    planoGeradoEm: plano?.createdAt.toISOString() ?? null,
  };
}

export function mensagemRecriarCopiloto(r: RecriarCopilotoResult, nomeAluno: string): string {
  const partes: string[] = [
    `Copiloto de ${nomeAluno} recriado.`,
    `Removidos: ${r.planosRemovidos} plano(s), ${r.questsRemovidas} quest(s).`,
    `Novo: plano (${r.regenerado.fonte}, ${r.regenerado.blocosPlano} blocos) e ${r.regenerado.questsPendentes} tarefa(s) pendentes.`,
  ];

  if (r.planoGeradoEm) {
    const quando = new Date(r.planoGeradoEm).toLocaleString("pt-BR");
    partes.push(`Plano gerado em ${quando}.`);
  }

  if (r.anamneseRemovida) {
    partes.push("Anamnese apagada — o aluno verá o banner na Home para refazer a conversa.");
  } else if (r.regenerado.fonte === "anamnese") {
    partes.push(
      "Anamnese mantida: o texto pode parecer parecido. Para mudança visível, apague a anamnese na próxima vez (2º confirm) ou peça para o aluno dar F5 na Home/Plano."
    );
  }

  if (r.planosRemovidos === 0 && r.questsRemovidas === 0) {
    partes.push("Aviso: não havia plano/quest antigo no banco — confira se é o aluno certo.");
  }

  if (r.regenerado.questsPendentes === 0) {
    partes.push("Aviso: nenhuma tarefa pendente criada — verifique anamnese ou registros de prova.");
  }

  return partes.join(" ");
}
