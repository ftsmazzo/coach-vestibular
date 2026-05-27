import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { gerarMicroPlanoProva } from "@/lib/micro-plano-prova";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id: provaId } = await params;
  const result = await gerarMicroPlanoProva(session.userId, provaId);

  if ("error" in result) {
    if (result.error === "PROVA_NOT_FOUND") {
      return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Registre pelo menos um resultado desta prova antes do micro-plano" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    planId: result.plan.id,
    quests: result.items.filter((i) => i.geraQuest !== false && i.duracaoMin > 0).length,
    mensagem: "Micro-plano e quests desta prova criados. Veja em Quests e no plano global.",
  });
}
