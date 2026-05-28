import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getQuestsDaProva, getQuestsDoPlanoAtual } from "@/lib/plano-atual";
import {
  getOQueFazerAgora,
  isQuestCopiloto,
  limparDescricaoQuest,
  tituloQuestExibicao,
} from "@/lib/quests-alavanca";
import type { StudyPlanItem } from "@/lib/study-plan";
import { pickRewardMessage } from "@/lib/messages";
import { tentarXpQuestsSemana } from "@/lib/xp";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const provaId = new URL(request.url).searchParams.get("provaId");

  let quests;
  let plan: { createdAt: Date; recoveryMode: boolean } | null = null;
  let items: StudyPlanItem[] = [];
  let provaNome: string | null = null;
  let prefix = "";

  if (provaId) {
    const daProva = await getQuestsDaProva(session.userId, provaId);
    quests = daProva.quests;
    plan = daProva.plan;
    items = daProva.items;
    provaNome = daProva.prova?.nome ?? null;
    prefix = provaNome ? `[${provaNome.slice(0, 20)}]` : "";
  } else {
    const global = await getQuestsDoPlanoAtual(session.userId);
    quests = global.quests;
    plan = global.plan;
    items = global.items;
  }

  let oQueFazerAgora: Awaited<ReturnType<typeof getOQueFazerAgora>> = [];
  if (!provaId) {
    const { buildJourneyInsight } = await import("@/lib/journey-insight");
    await buildJourneyInsight(session.userId);
    oQueFazerAgora = await getOQueFazerAgora(session.userId);
  }

  const copilotoConcluidas = provaId
    ? []
    : (
        await prisma.quest.findMany({
          where: { userId: session.userId, status: "done" },
          orderBy: { completedAt: "desc" },
          take: 20,
        })
      )
        .filter(isQuestCopiloto)
        .map((q) => ({
          id: q.id,
          titulo: tituloQuestExibicao(q.titulo),
          descricao: limparDescricaoQuest(q.descricao),
          duracaoMin: q.duracaoMin,
          status: "done" as const,
          rewardMsg: q.rewardMsg,
          ordemPlano: null,
          meta: { bloco: "copiloto" as const },
        }));

  const ordemPorTitulo = new Map<string, number>();
  const metaPorTitulo = new Map<
    string,
    {
      ordem: number;
      bloco?: string;
      materiaDestaque?: string;
      errosNaMateria?: number;
    }
  >();

  for (const i of items) {
    const meta = {
      ordem: i.ordem,
      bloco: i.bloco,
      materiaDestaque: i.materiaDestaque,
      errosNaMateria: i.errosNaMateria,
    };
    ordemPorTitulo.set(i.titulo, i.ordem);
    metaPorTitulo.set(i.titulo, meta);
    if (prefix) {
      const tituloPref = `${prefix} ${i.titulo}`;
      ordemPorTitulo.set(tituloPref, i.ordem);
      metaPorTitulo.set(tituloPref, meta);
    }
  }

  function metaForQuest(titulo: string) {
    return metaPorTitulo.get(titulo) ?? metaPorTitulo.get(titulo.replace(/^(\[[^\]]+\]\s*)/, "")) ?? null;
  }

  const questsPlano = quests
    .filter((q) => !isQuestCopiloto(q))
    .map((q) => ({
      ...q,
      descricao: limparDescricaoQuest(q.descricao),
      ordemPlano: ordemPorTitulo.get(q.titulo) ?? metaForQuest(q.titulo)?.ordem ?? null,
      meta: metaPorTitulo.get(q.titulo) ?? metaForQuest(q.titulo),
    }));

  return NextResponse.json({
    quests: questsPlano,
    oQueFazerAgora: oQueFazerAgora.map((q) => ({
      id: q.id,
      titulo: q.titulo,
      descricao: q.descricao,
      duracaoMin: q.duracaoMin,
      status: "pending",
      rewardMsg: null,
      ordemPlano: q.ordem,
      meta: { bloco: "copiloto" as const, rotulo: q.rotulo },
    })),
    copilotoConcluidas,
    questsAlavanca: [],
    planoAtualizadoEm: plan?.createdAt ?? null,
    recoveryMode: plan?.recoveryMode ?? false,
    provaId: provaId ?? null,
    provaNome,
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

  let xpSemana: { ganhou: number; mensagem?: string } = { ganhou: 0 };
  if (body.status === "done") {
    xpSemana = await tentarXpQuestsSemana(session.userId);
  }

  return NextResponse.json({
    ...quest,
    xpSemanaGanho: xpSemana.ganhou,
    xpSemanaMensagem: xpSemana.mensagem,
  });
}
