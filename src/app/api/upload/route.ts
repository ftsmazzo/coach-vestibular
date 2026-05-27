import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Fase 2 — Upload de prova (stub).
 * Em produção: OCR + LLM para extrair questões e classificar temas.
 * Guardrails: não diagnosticar saúde mental; só dados de estudo.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 400 });

  const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: "Formato não suportado. Use PDF ou imagem." }, { status: 400 });
  }

  const job = await prisma.uploadJob.create({
    data: {
      userId: session.userId,
      fileName: file.name,
      status: "queued",
      resultJson: JSON.stringify({
        message:
          "Upload recebido. A extração automática (OCR + IA) será processada na Fase 2. Por agora, use o registro manual ou importação CSV.",
        guardrails: [
          "Não emitir diagnóstico médico ou psicológico",
          "Classificação de questões sujeita a revisão humana",
          "Dados usados apenas para apoio ao estudo do aluno",
        ],
        suggestedAction: "/listas/solicitar",
      }),
    },
  });

  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    ...(job.resultJson ? { result: JSON.parse(job.resultJson) } : {}),
  });
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const jobs = await prisma.uploadJob.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return NextResponse.json(jobs);
}
