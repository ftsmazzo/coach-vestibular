import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

/** Reabre o passo 3 para correções sem apagar questões nem classificação já feita. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id: provaId } = await params;
  const prova = await prisma.prova.findUnique({ where: { id: provaId } });
  if (!prova) {
    return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });
  }

  await prisma.prova.update({
    where: { id: provaId },
    data: { extracaoValidada: false },
  });

  return NextResponse.json({
    extracaoValidada: false,
    mensagem: "Extração reaberta para correção. Questões e classificação no banco foram mantidas.",
  });
}
