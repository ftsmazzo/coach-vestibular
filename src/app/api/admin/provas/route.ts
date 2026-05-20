import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const provas = await prisma.prova.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { questoes: true, tentativas: true } },
    },
  });
  return NextResponse.json(provas);
}

const createSchema = z.object({
  nome: z.string().min(1),
  banca: z.string().default("ENEM"),
  tipo: z.enum(["ENEM_OFICIAL", "SIMULADO", "VESTIBULAR", "OUTRO"]).default("SIMULADO"),
  ano: z.number().int().optional(),
  dia: z.number().int().optional(),
  caderno: z.string().optional(),
  descricao: z.string().optional(),
  totalQuestoes: z.number().int().positive(),
  publicada: z.boolean().optional(),
});

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const body = createSchema.parse(await request.json());
  const prova = await prisma.prova.create({ data: body });
  return NextResponse.json(prova);
}
