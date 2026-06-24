import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { executarFaseN1Prova } from "@/lib/prova-classificacao-fases";
import { refreshProvaGabaritoFlag } from "@/lib/prova-attempt";

export const maxDuration = 600;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id: provaId } = await params;

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY não configurada no servidor." },
      { status: 503 }
    );
  }

  try {
    const resultado = await executarFaseN1Prova(provaId);
    await refreshProvaGabaritoFlag(provaId);
    return NextResponse.json({
      ok: true,
      fase: "N1",
      ...resultado,
      mensagem: `Fase N1: ${resultado.ok}/${resultado.total} questões com catálogo destino.`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro na fase N1";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
