import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { corrigirQuiz } from "@/lib/ciclo-quiz";

const schema = z.object({
  quizId: z.string(),
  respostas: z.record(z.string(), z.string()),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = schema.parse(await request.json());
  const r = await corrigirQuiz(session.userId, body.quizId, body.respostas);
  if ("error" in r) {
    return NextResponse.json({ error: "Quiz não encontrado" }, { status: 404 });
  }
  return NextResponse.json(r);
}
