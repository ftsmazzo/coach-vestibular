import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  montarRelatorioExtracaoComCobertura,
  resumoExtracao,
} from "@/lib/prova-extracao-relatorio";
import { sincronizarMetadadosPosExtracao } from "@/lib/prova-pos-extracao";
import { prisma } from "@/lib/prisma";
import { compararPorOrdemExtracao } from "@/lib/prova-questao-ordem";

export async function POST(
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

  let relatorio = montarRelatorioExtracaoComCobertura(questoes, prova);

  if (!relatorio.prontaParaValidar) {
    return NextResponse.json(
      {
        error: `Extração incompleta: ${resumoExtracao(relatorio)}. Resolva cobertura, alternativas e enunciados antes de confirmar.`,
        relatorio,
      },
      { status: 422 }
    );
  }

  const sync = await sincronizarMetadadosPosExtracao(provaId);

  const provaAtual = await prisma.prova.findUnique({
    where: { id: provaId },
    include: { questoes: true },
  });
  if (!provaAtual) {
    return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });
  }

  const questoesAtual = [...provaAtual.questoes].sort(compararPorOrdemExtracao);
  relatorio = montarRelatorioExtracaoComCobertura(questoesAtual, provaAtual);

  if (!relatorio.prontaParaValidar) {
    return NextResponse.json(
      {
        error: `Após sincronizar metadados: ${resumoExtracao(relatorio)}. Revise faixa EN/ES na aba Prova se necessário.`,
        relatorio,
        sync,
      },
      { status: 422 }
    );
  }

  await prisma.prova.update({
    where: { id: provaId },
    data: { extracaoValidada: true },
  });

  return NextResponse.json({
    extracaoValidada: true,
    relatorio,
    sync,
    mensagem: "Extração validada. Gabarito e classificação liberados na aba Pedagogia.",
  });
}
