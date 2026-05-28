import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import {
  isSolicitacaoStatus,
  STATUS_SOLICITACAO_PENDENTE,
  STATUS_SOLICITACAO_PROCESSADA,
} from "@/lib/solicitacao-simulado";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = (await request.json()) as { acao?: string };
  const acao = body.acao;

  const job = await prisma.uploadJob.findUnique({ where: { id } });
  if (!job || !isSolicitacaoStatus(job.status)) {
    return NextResponse.json({ error: "Solicitação não encontrada" }, { status: 404 });
  }

  if (acao === "processar") {
    await prisma.uploadJob.update({
      where: { id },
      data: { status: STATUS_SOLICITACAO_PROCESSADA },
    });
    return NextResponse.json({
      ok: true,
      status: STATUS_SOLICITACAO_PROCESSADA,
      mensagem: "Marcada como processada.",
    });
  }

  if (acao === "reabrir") {
    await prisma.uploadJob.update({
      where: { id },
      data: { status: STATUS_SOLICITACAO_PENDENTE },
    });
    return NextResponse.json({
      ok: true,
      status: STATUS_SOLICITACAO_PENDENTE,
      mensagem: "Voltou para a fila pendente.",
    });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
