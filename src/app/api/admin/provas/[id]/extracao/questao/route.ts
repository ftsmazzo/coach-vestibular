import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { atualizarQuestaoExtracaoManual } from "@/lib/prova-questoes-persist";

const bodySchema = z.object({
  questaoId: z.string().min(1),
  enunciado: z.string().min(15),
  alternativas: z.string().nullable().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id: provaId } = await params;
  const body = bodySchema.parse(await request.json());

  try {
    const { id } = await atualizarQuestaoExtracaoManual(provaId, {
      questaoId: body.questaoId,
      enunciado: body.enunciado,
      alternativas: body.alternativas,
    });
    return NextResponse.json({ ok: true, questaoId: id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao gravar questão";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
