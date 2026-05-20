import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createExamWithDiagnosis } from "@/lib/exam-service";
import { prisma } from "@/lib/prisma";

const questionSchema = z.object({
  numero: z.number().int().positive(),
  correto: z.boolean(),
  materiaId: z.string().optional(),
  temaId: z.string().optional(),
  tipoErro: z.enum(["base_teorica", "interpretacao", "atencao", "tempo"]).optional(),
  observacao: z.string().optional(),
});

const createSchema = z.object({
  nome: z.string().min(1),
  data: z.string(),
  banca: z.string().optional(),
  totalQuestoes: z.number().int().positive(),
  nota: z.number().optional(),
  checkInScore: z.number().int().min(1).max(5).optional(),
  questoes: z.array(questionSchema).min(1),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const exams = await prisma.exam.findMany({
    where: { userId: session.userId },
    orderBy: { data: "desc" },
    include: { diagnosticSnapshot: true, questionAttempts: true },
  });

  return NextResponse.json(exams);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = createSchema.parse(await request.json());
    const result = await createExamWithDiagnosis({
      userId: session.userId,
      ...body,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Erro ao salvar simulado" }, { status: 500 });
  }
}
