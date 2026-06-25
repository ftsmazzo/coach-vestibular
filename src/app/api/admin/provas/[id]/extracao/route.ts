import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { montarRelatorioExtracao, resumoExtracao } from "@/lib/prova-extracao-relatorio";
import { prisma } from "@/lib/prisma";
import { compararPorOrdemExtracao } from "@/lib/prova-questao-ordem";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id: provaId } = await params;
  const prova = await prisma.prova.findUnique({
    where: { id: provaId },
    include: { questoes: true },
  });
  if (!prova) {
    return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });
  }

  const questoes = [...prova.questoes].sort(compararPorOrdemExtracao);
  const relatorio = montarRelatorioExtracao(questoes, prova.totalQuestoes);

  return NextResponse.json({
    extracaoValidada: prova.extracaoValidada,
    resumo: resumoExtracao(relatorio),
    relatorio,
  });
}
