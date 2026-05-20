import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { parseProvaQuestoesCsv } from "@/lib/parse-prova-csv";
import { refreshProvaGabaritoFlag } from "@/lib/prova-attempt";

const questaoSchema = z.object({
  numero: z.number().int().positive(),
  areaBloco: z.string().optional().nullable(),
  materia: z.string().min(1),
  assunto: z.string().min(1),
  conhecimentoExigido: z.string().optional().nullable(),
  nivelDificuldade: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
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
    let incluirGabarito = false;
    let substituir = true;
    if (contentType.includes("multipart")) {
      const form = await request.formData();
      const file = form.get("file") as File | null;
      if (!file) return NextResponse.json({ error: "Arquivo CSV obrigatório" }, { status: 400 });
      csvText = await file.text();
      incluirGabarito = form.get("incluirGabarito") === "true";
      substituir = form.get("modo") !== "adicionar";
    } else {
      csvText = await request.text();
    }

    const rows = parseProvaQuestoesCsv(csvText, { incluirGabarito });
    if (rows.length === 0) {
      return NextResponse.json({ error: "CSV vazio ou inválido" }, { status: 400 });
    }

    if (substituir) {
      await prisma.provaQuestao.deleteMany({ where: { provaId } });
      await prisma.provaQuestao.createMany({
        data: rows.map((r) => ({
          provaId,
          numero: r.numero,
          areaBloco: r.areaBloco ?? null,
          materia: r.materia,
          assunto: r.assunto,
          conhecimentoExigido: r.conhecimentoExigido ?? null,
          nivelDificuldade: r.nivelDificuldade ?? null,
          observacoes: r.observacoes ?? null,
          gabarito: r.gabarito ?? null,
        })),
      });
    } else {
      for (const r of rows) {
        await prisma.provaQuestao.upsert({
          where: { provaId_numero: { provaId, numero: r.numero } },
          create: {
            provaId,
            numero: r.numero,
            areaBloco: r.areaBloco ?? null,
            materia: r.materia,
            assunto: r.assunto,
            conhecimentoExigido: r.conhecimentoExigido ?? null,
            nivelDificuldade: r.nivelDificuldade ?? null,
            observacoes: r.observacoes ?? null,
            gabarito: r.gabarito ?? null,
          },
          update: {
            areaBloco: r.areaBloco ?? null,
            materia: r.materia,
            assunto: r.assunto,
            conhecimentoExigido: r.conhecimentoExigido ?? null,
            nivelDificuldade: r.nivelDificuldade ?? null,
            observacoes: r.observacoes ?? null,
            ...(r.gabarito ? { gabarito: r.gabarito } : {}),
          },
        });
      }
    }

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
