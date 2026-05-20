import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { statsQuestoesProva } from "@/lib/prova-stats";
import { prisma } from "@/lib/prisma";

/** Provas publicadas disponíveis para o aluno registrar tentativa */
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

  return NextResponse.json(
    provas.map((p) => {
      const stats = statsQuestoesProva(p.questoes, p.totalQuestoes);
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
      };
    })
  );
}
