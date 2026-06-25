import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ErrorType } from "@/generated/prisma/client";
import type { MetadadosCognitivosErro } from "@/lib/metadados-cognitivos";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;

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
        metadadosCognitivos?: MetadadosCognitivosErro | null;
      }>;
    };

    if (!Array.isArray(attempts)) {
      return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
    }

    await prisma.$transaction(
      attempts.map((att) => {
        const meta: MetadadosCognitivosErro | null = att.metadadosCognitivos ?? null;
        const observacao =
          att.observacao !== undefined && att.observacao !== null
            ? att.observacao
            : meta?.observacaoAluno ?? null;

        return prisma.questionAttempt.update({
          where: { id: att.id, examId: id },
          data: {
            tipoErro: att.tipoErro || null,
            observacao,
            metadadosCognitivosJson: meta ? JSON.stringify(meta) : null,
          },
        });
      })
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
