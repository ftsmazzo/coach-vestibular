import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { parseProvaQuestoesCsv } from "@/lib/parse-prova-csv";
import { refreshProvaGabaritoFlag } from "@/lib/prova-attempt";

const questaoSchema = z.object({
  numero: z.number().int().positive(),
  caderno: z.string().optional(),
  materia: z.string().min(1),
  assunto: z.string().min(1),
  conhecimentoExigido: z.string().optional(),
  nivelDificuldade: z.string().optional(),
  observacoes: z.string().optional(),
  gabarito: z.string().regex(/^[A-Ea-e]$/).optional().nullable(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id: provaId } = await params;
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("text/csv") || contentType.includes("multipart")) {
    let csvText = "";
    if (contentType.includes("multipart")) {
      const form = await request.formData();
      const file = form.get("file") as File | null;
      if (!file) return NextResponse.json({ error: "Arquivo CSV obrigatório" }, { status: 400 });
      csvText = await file.text();
    } else {
      csvText = await request.text();
    }

    const rows = parseProvaQuestoesCsv(csvText);
    if (rows.length === 0) {
      return NextResponse.json({ error: "CSV vazio ou inválido" }, { status: 400 });
    }

    await prisma.provaQuestao.deleteMany({ where: { provaId } });
    await prisma.provaQuestao.createMany({
      data: rows.map((r) => ({
        provaId,
        numero: r.numero,
        caderno: r.caderno,
        materia: r.materia,
        assunto: r.assunto,
        conhecimentoExigido: r.conhecimentoExigido,
        nivelDificuldade: r.nivelDificuldade,
        observacoes: r.observacoes,
        gabarito: r.gabarito,
      })),
    });

    await prisma.prova.update({
      where: { id: provaId },
      data: { totalQuestoes: rows.length },
    });
    await refreshProvaGabaritoFlag(provaId);

    const questoes = await prisma.provaQuestao.findMany({
      where: { provaId },
      orderBy: { numero: "asc" },
    });
    return NextResponse.json({ imported: rows.length, questoes });
  }

  const body = z.union([questaoSchema, z.array(questaoSchema)]).parse(await request.json());
  const list = Array.isArray(body) ? body : [body];

  for (const q of list) {
    await prisma.provaQuestao.upsert({
      where: { provaId_numero: { provaId, numero: q.numero } },
      create: { provaId, ...q, gabarito: q.gabarito?.toUpperCase() },
      update: { ...q, gabarito: q.gabarito?.toUpperCase() ?? null },
    });
  }

  await refreshProvaGabaritoFlag(provaId);
  const questoes = await prisma.provaQuestao.findMany({
    where: { provaId },
    orderBy: { numero: "asc" },
  });
  return NextResponse.json(questoes);
}
