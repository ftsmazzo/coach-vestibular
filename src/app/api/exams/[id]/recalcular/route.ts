import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { recalcularDiagnosticoExam } from "@/lib/prova-attempt";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;

  try {
    const result = await recalcularDiagnosticoExam(id, session.userId);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro";
    if (msg === "EXAM_NOT_FOUND") {
      return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });
    }
    if (msg === "SEM_PROVA_VINCULADA") {
      return NextResponse.json(
        { error: "Só é possível recalcular registros feitos a partir de uma prova do catálogo" },
        { status: 400 }
      );
    }
    if (msg === "SEM_QUESTOES") {
      return NextResponse.json({ error: "Registro sem questões para analisar" }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Erro ao recalcular diagnóstico" }, { status: 500 });
  }
}
