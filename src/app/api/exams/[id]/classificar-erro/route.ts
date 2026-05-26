import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ErrorType } from "@/generated/prisma/client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  
  // Verify that the exam belongs to the user
  const exam = await prisma.exam.findFirst({
    where: { id, userId: session.userId },
  });

  if (!exam) {
    return NextResponse.json({ error: "Simulado não encontrado" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { attempts } = body as {
      attempts: Array<{
        id: string;
        tipoErro: ErrorType | null;
        observacao: string | null;
      }>;
    };

    if (!Array.isArray(attempts)) {
      return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
    }

    // Update all attempts in a transaction
    await prisma.$transaction(
      attempts.map((att) =>
        prisma.questionAttempt.update({
          where: { id: att.id, examId: id },
          data: {
            tipoErro: att.tipoErro || null,
            observacao: att.observacao !== undefined ? att.observacao : undefined,
          },
        })
      )
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Erro ao salvar classificação de erros:", error);
    return NextResponse.json(
      { error: "Erro interno ao salvar classificação de erros" },
      { status: 500 }
    );
  }
}
