import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { normalizarAreaBloco } from "@/lib/areas-bloco";
import { upsertQuestaoExtracaoManual } from "@/lib/prova-questoes-persist";

const bodySchema = z.object({
  numero: z.number().int().positive(),
  idiomaVariante: z.enum(["COMUM", "INGLES", "ESPANHOL"]).default("COMUM"),
  enunciado: z.string().min(15),
  alternativas: z.string().nullable().optional(),
  areaBloco: z.string().nullable().optional(),
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
    const { id } = await upsertQuestaoExtracaoManual(provaId, {
      numero: body.numero,
      idiomaVariante: body.idiomaVariante,
      enunciado: body.enunciado,
      alternativas: body.alternativas,
      areaBloco:
        body.areaBloco != null
          ? normalizarAreaBloco(body.areaBloco) ?? body.areaBloco
          : undefined,
    });
    return NextResponse.json({ ok: true, questaoId: id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao gravar questão";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
