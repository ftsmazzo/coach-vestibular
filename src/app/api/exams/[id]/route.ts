import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { regenerarPlanoGlobalUsuario } from "@/lib/prova-attempt";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const exam = await prisma.exam.findFirst({
    where: { id, userId: session.userId },
  });

  if (!exam) {
    return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });
  }

  await prisma.exam.delete({ where: { id } });

  try {
    await regenerarPlanoGlobalUsuario(session.userId);
  } catch {
    /* jornada vazia — plano antigo já foi invalidado pelo delete */
  }

  return NextResponse.json({ ok: true, removido: exam.nome, planoAtualizado: true });
}
