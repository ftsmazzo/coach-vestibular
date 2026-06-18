import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { gerarMicroPlanoConjunto } from "@/lib/micro-plano-conjunto";
import { parseConjuntoExamId } from "@/lib/prova-multidia";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  if (!parseConjuntoExamId(id)) {
    return NextResponse.json({ error: "Prova unificada inválida" }, { status: 400 });
  }

  const result = await gerarMicroPlanoConjunto(session.userId, id);

  if ("error" in result) {
    if (result.error === "CONJUNTO_NOT_FOUND" || result.error === "CONJUNTO_INVALIDO") {
      return NextResponse.json({ error: "Prova completa não encontrada" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Registre dia 1 e dia 2 antes do micro-plano completo" },
      { status: 400 }
    );
  }

  revalidatePath(`/provas/conjunto/${id}/lente`);

  const mensagem =
    result.fonte === "ia"
      ? `Análise da prova completa (180 questões): diagnóstico, micro-plano e ${result.questsCount} quest(s).`
      : `Micro-plano completo e ${result.questsCount} quest(s) criados.`;

  return NextResponse.json({
    ok: true,
    planId: result.plan.id,
    quests: result.questsCount,
    fonte: result.fonte,
    mensagem,
  });
}
