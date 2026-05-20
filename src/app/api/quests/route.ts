import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getQuestsDoPlanoAtual } from "@/lib/plano-atual";
import { pickRewardMessage } from "@/lib/messages";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { quests, plan, items } = await getQuestsDoPlanoAtual(session.userId);

  const ordemPorTitulo = new Map(items.map((i) => [i.titulo, i.ordem]));
  const metaPorTitulo = new Map(
    items.map((i) => [
      i.titulo,
      {
        ordem: i.ordem,
        bloco: i.bloco,
        materiaDestaque: i.materiaDestaque,
        errosNaMateria: i.errosNaMateria,
      },
    ])
  );

  return NextResponse.json({
    quests: quests.map((q) => ({
      ...q,
      ordemPlano: ordemPorTitulo.get(q.titulo) ?? null,
      meta: metaPorTitulo.get(q.titulo) ?? null,
    })),
    planoAtualizadoEm: plan?.createdAt ?? null,
    recoveryMode: plan?.recoveryMode ?? false,
  });
}

const patchSchema = z.object({
  id: z.string(),
  status: z.enum(["pending", "done", "skipped"]).optional(),
  moodAfter: z.number().int().min(1).max(5).optional(),
});

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = patchSchema.parse(await request.json());
  const existing = await prisma.quest.findFirst({
    where: { id: body.id, userId: session.userId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Quest não encontrada" }, { status: 404 });
  }
  const quest = await prisma.quest.update({
    where: { id: body.id },
    data: {
      status: body.status,
      moodAfter: body.moodAfter,
      completedAt: body.status === "done" ? new Date() : undefined,
      rewardMsg: body.status === "done" ? pickRewardMessage("questComplete") : undefined,
    },
  });
  return NextResponse.json(quest);
}
