import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import type { FeedbackStatus, FeedbackTipo } from "@/generated/prisma/client";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as FeedbackStatus | null;
  const tipo = searchParams.get("tipo") as FeedbackTipo | null;

  const feedbacks = await prisma.feedback.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(tipo ? { tipo } : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: { user: { select: { name: true, email: true } } },
  });

  const lista = feedbacks.map((f) => {
    let contexto: Record<string, unknown> | null = null;
    if (f.contextoJson) {
      try {
        contexto = JSON.parse(f.contextoJson) as Record<string, unknown>;
      } catch {
        contexto = null;
      }
    }
    return {
      id: f.id,
      tipo: f.tipo,
      status: f.status,
      titulo: f.titulo,
      descricao: f.descricao,
      esperado: f.esperado,
      severidade: f.severidade,
      pagina: f.pagina,
      contexto,
      temAnexo: Boolean(f.anexoPath),
      notaAdmin: f.notaAdmin,
      aluno: { nome: f.user.name, email: f.user.email },
      createdAt: f.createdAt.toISOString(),
    };
  });

  const contagem = await prisma.feedback.groupBy({
    by: ["status"],
    _count: true,
  });

  return NextResponse.json({
    feedbacks: lista,
    contagem: Object.fromEntries(contagem.map((c) => [c.status, c._count])),
  });
}
