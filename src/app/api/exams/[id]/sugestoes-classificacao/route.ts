import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { labelEscopo } from "@/lib/escopo-display-server";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  numero: z.number().int().positive(),
  texto: z.string().min(10, "Descreva o que está errado (mín. 10 caracteres)"),
  escopoSugeridoId: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id: examId } = await params;

  try {
    const body = createSchema.parse(await request.json());

    const exam = await prisma.exam.findFirst({
      where: { id: examId, userId: session.userId },
      include: {
        questionAttempts: { include: { provaQuestao: true } },
      },
    });
    if (!exam) {
      return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });
    }

    const attempt = exam.questionAttempts.find((a) => a.numero === body.numero);
    if (!attempt) {
      return NextResponse.json({ error: "Questão não encontrada neste registro" }, { status: 400 });
    }

    const pendente = await prisma.sugestaoClassificacao.findFirst({
      where: {
        userId: session.userId,
        examId,
        numero: body.numero,
        status: "PENDENTE",
      },
    });
    if (pendente) {
      return NextResponse.json(
        { error: "Você já tem uma sugestão pendente para esta questão" },
        { status: 400 }
      );
    }

    const pq = attempt.provaQuestao;
    const escopoAtualId = pq?.conhecimentoEscopoId ?? null;
    const escopoSugeridoId = body.escopoSugeridoId?.trim() || null;

    const sugestao = await prisma.sugestaoClassificacao.create({
      data: {
        userId: session.userId,
        examId,
        provaQuestaoId: attempt.provaQuestaoId,
        numero: body.numero,
        materiaAtual: pq?.materia ?? "—",
        assuntoAtual: pq?.assunto ?? "—",
        areaBlocoAtual: pq?.areaBloco,
        escopoAtualId,
        escopoLabelAtual: labelEscopo(escopoAtualId),
        escopoSugeridoId,
        escopoLabelSugerido: labelEscopo(escopoSugeridoId),
        texto: body.texto.trim(),
      },
    });

    return NextResponse.json({
      ok: true,
      id: sugestao.id,
      mensagem: "Obrigado! A equipe vai revisar sua sugestão de escopo N2.",
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Erro ao enviar sugestão" }, { status: 500 });
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id: examId } = await params;

  const sugestoes = await prisma.sugestaoClassificacao.findMany({
    where: { examId, userId: session.userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      numero: true,
      status: true,
      xpConcedido: true,
      createdAt: true,
    },
  });

  return NextResponse.json(sugestoes);
}
