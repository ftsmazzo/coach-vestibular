import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { aceitarEnunciadoExtracaoProva } from "@/lib/prova-questoes-persist";

const bodySchema = z.object({
  numero: z.number().int().positive(),
  idiomaVariante: z.enum(["COMUM", "INGLES", "ESPANHOL"]).default("COMUM"),
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
    const { id } = await aceitarEnunciadoExtracaoProva(provaId, {
      numero: body.numero,
      idiomaVariante: body.idiomaVariante,
    });
    return NextResponse.json({ ok: true, questaoId: id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao aceitar enunciado";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
