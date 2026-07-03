import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { normalizarAreaBloco } from "@/lib/areas-bloco";
import { refreshProvaGabaritoFlag } from "@/lib/prova-attempt";
import { criarOuAtualizarQuestaoManual } from "@/lib/prova-questoes-persist";

const bodySchema = z.object({
  numero: z.number().int().positive(),
  enunciado: z.string().min(10),
  alternativas: z.string().nullable().optional(),
  areaBloco: z.string().nullable().optional(),
  gabarito: z.string().regex(/^[A-Ea-e]$/).nullable().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id: provaId } = await params;
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (e) {
    const msg =
      e instanceof z.ZodError
        ? e.issues.map((i) => i.message).join("; ")
        : "Dados inválidos";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    const areaBloco =
      body.areaBloco != null && body.areaBloco !== ""
        ? normalizarAreaBloco(body.areaBloco, "A classificar")
        : body.areaBloco ?? null;

    const { id, criada } = await criarOuAtualizarQuestaoManual(provaId, {
      numero: body.numero,
      enunciado: body.enunciado,
      alternativas: body.alternativas,
      areaBloco,
      gabarito: body.gabarito?.toUpperCase() ?? null,
    });

    await refreshProvaGabaritoFlag(provaId);

    return NextResponse.json({
      ok: true,
      questaoId: id,
      criada,
      mensagem: criada
        ? `Questão ${body.numero} criada.`
        : `Questão ${body.numero} atualizada.`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao gravar questão";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
