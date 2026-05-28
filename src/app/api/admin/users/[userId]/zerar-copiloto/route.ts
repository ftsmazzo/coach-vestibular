import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { recriarCopilotoDoZero } from "@/lib/zerar-copiloto-usuario";

const bodySchema = z.object({
  incluirAnamnese: z.boolean().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { userId } = await params;
  const aluno = await prisma.user.findFirst({
    where: { id: userId, role: "STUDENT" },
    select: { id: true, name: true },
  });
  if (!aluno) {
    return NextResponse.json({ error: "Aluno não encontrado" }, { status: 404 });
  }

  let incluirAnamnese = false;
  try {
    const raw = await request.json();
    if (raw && typeof raw === "object") {
      incluirAnamnese = bodySchema.parse(raw).incluirAnamnese ?? false;
    }
  } catch {
    /* body vazio = só plano/quests */
  }

  const resultado = await recriarCopilotoDoZero(userId, { incluirAnamnese });

  return NextResponse.json({
    ok: true,
    aluno: aluno.name,
    ...resultado,
    mensagem:
      `Copiloto recriado para ${aluno.name}: ${resultado.planosRemovidos} plano(s) e ${resultado.questsRemovidas} quest(s) removidos; novo plano e lista gerados a partir dos registros atuais.` +
      (resultado.anamneseRemovida ? " Anamnese apagada — banner volta na Home." : ""),
  });
}
