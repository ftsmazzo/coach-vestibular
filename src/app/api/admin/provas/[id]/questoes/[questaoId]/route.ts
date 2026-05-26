import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import {
  normalizarLabelAssunto,
  normalizarLabelMateria,
} from "@/lib/taxonomia-validacao";

const patchSchema = z.object({
  areaBloco: z.string().nullable().optional(),
  materia: z.string().min(1).optional(),
  assunto: z.string().min(1).optional(),
  conhecimentoExigido: z.string().nullable().optional(),
  nivelDificuldade: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
  gabarito: z.string().regex(/^[A-Ea-e]$/).nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; questaoId: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id: provaId, questaoId } = await params;
  const body = patchSchema.parse(await request.json());

  const existente = await prisma.provaQuestao.findFirst({
    where: { id: questaoId, provaId },
  });
  if (!existente) {
    return NextResponse.json({ error: "Questão não encontrada" }, { status: 404 });
  }

  const materia = body.materia
    ? normalizarLabelMateria(body.materia)
    : existente.materia;
  const assunto = body.assunto
    ? normalizarLabelAssunto(materia, body.assunto)
    : existente.assunto;

  const atualizada = await prisma.provaQuestao.update({
    where: { id: questaoId },
    data: {
      ...(body.areaBloco !== undefined ? { areaBloco: body.areaBloco } : {}),
      materia,
      assunto,
      ...(body.conhecimentoExigido !== undefined
        ? { conhecimentoExigido: body.conhecimentoExigido }
        : {}),
      ...(body.nivelDificuldade !== undefined
        ? { nivelDificuldade: body.nivelDificuldade }
        : {}),
      ...(body.observacoes !== undefined ? { observacoes: body.observacoes } : {}),
      ...(body.gabarito !== undefined
        ? { gabarito: body.gabarito?.toUpperCase() ?? null }
        : {}),
    },
  });

  return NextResponse.json(atualizada);
}
