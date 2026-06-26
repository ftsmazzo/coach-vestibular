import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { atribuirAreasProvaDoCaderno } from "@/lib/prova-atribuir-area-caderno";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id: provaId } = await params;

  try {
    const resultado = await atribuirAreasProvaDoCaderno(provaId);
    return NextResponse.json({
      ok: true,
      ...resultado,
      mensagem:
        resultado.atualizadas > 0
          ? `${resultado.atualizadas} questão(ões) com área/bloco atribuído a partir do PDF.`
          : resultado.avisos[0] ?? "Nenhuma área atribuída.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao atribuir áreas";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
