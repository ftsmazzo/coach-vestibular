import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { dataAplicacaoParaInput, formatDataAplicacao } from "@/lib/data-prova";
import { statsQuestoesProva } from "@/lib/prova-stats";
import { prisma } from "@/lib/prisma";

/** Provas publicadas + resumo das tentativas do aluno logado */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const provas = await prisma.prova.findMany({
    where: { publicada: true },
    orderBy: [{ ano: "desc" }, { nome: "asc" }],
    include: {
      questoes: { select: { numero: true } },
    },
  });

  const provaIds = provas.map((p) => p.id);
  const exams =
    provaIds.length > 0
      ? await prisma.exam.findMany({
          where: {
            userId: session.userId,
            provaId: { in: provaIds },
          },
          include: { questionAttempts: true },
          orderBy: { data: "desc" },
        })
      : [];

  const tentativasPorProvaId = new Map<
    string,
    Array<{
      id: string;
      dataLabel: string;
      dataInput: string;
      pctAcerto: number;
      acertos: number;
      total: number;
    }>
  >();

  for (const e of exams) {
    if (!e.provaId) continue;
    const total = e.questionAttempts.length;
    const acertos = e.questionAttempts.filter((q) => q.correto).length;
    const item = {
      id: e.id,
      dataLabel: formatDataAplicacao(e.data),
      dataInput: dataAplicacaoParaInput(e.data),
      pctAcerto: total > 0 ? Math.round((acertos / total) * 100) : 0,
      acertos,
      total,
    };
    const lista = tentativasPorProvaId.get(e.provaId) ?? [];
    lista.push(item);
    tentativasPorProvaId.set(e.provaId, lista);
  }

  return NextResponse.json(
    provas.map((p) => {
      const stats = statsQuestoesProva(p.questoes, p.totalQuestoes);
      const tentativas = tentativasPorProvaId.get(p.id) ?? [];
      return {
        id: p.id,
        nome: p.nome,
        banca: p.banca,
        tipo: p.tipo,
        ano: p.ano,
        caderno: p.caderno,
        totalQuestoes: p.totalQuestoes,
        gabaritoCompleto: p.gabaritoCompleto,
        questoesCount: stats.cadastradas,
        bancoIncompleto: stats.incompleto,
        minhasTentativas: tentativas.length,
        tentativas,
      };
    })
  );
}
