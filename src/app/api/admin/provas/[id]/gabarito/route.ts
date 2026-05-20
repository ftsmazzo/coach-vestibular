import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { refreshProvaGabaritoFlag } from "@/lib/prova-attempt";

/** Atualização em lote do gabarito por número da questão */
const schema = z.object({
  itens: z.array(
    z.object({
      numero: z.number().int().positive(),
      gabarito: z.string().regex(/^[A-Ea-e]$/),
    })
  ),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id: provaId } = await params;
  const { itens } = schema.parse(await request.json());

  for (const item of itens) {
    await prisma.provaQuestao.updateMany({
      where: { provaId, numero: item.numero },
      data: { gabarito: item.gabarito.toUpperCase() },
    });
  }

  const completo = await refreshProvaGabaritoFlag(provaId);
  return NextResponse.json({ ok: true, gabaritoCompleto: completo, updated: itens.length });
}
