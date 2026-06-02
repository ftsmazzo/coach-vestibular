import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { gerarOuObterQuiz } from "@/lib/ciclo-quiz";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const quiz = await gerarOuObterQuiz(session.userId);
  return NextResponse.json(quiz);
}
