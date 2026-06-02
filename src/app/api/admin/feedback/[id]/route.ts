import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  status: z.enum(["NOVO", "EM_ANALISE", "RESOLVIDO", "ARQUIVADO"]).optional(),
  notaAdmin: z.string().max(4000).optional().nullable(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = patchSchema.parse(await request.json());

  const existing = await prisma.feedback.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Report não encontrado" }, { status: 404 });

  const feedback = await prisma.feedback.update({
    where: { id },
    data: {
      status: body.status,
      notaAdmin: body.notaAdmin === undefined ? undefined : body.notaAdmin,
    },
  });

  return NextResponse.json({ ok: true, status: feedback.status });
}
