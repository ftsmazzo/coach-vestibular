import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { catalogoN1Valido } from "@/lib/catalogos-n1-destino";
import { listarEscoposCatalogoN1 } from "@/lib/prova-classificacao-manual-n2";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ catalogoId: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { catalogoId } = await params;
  if (!catalogoN1Valido(catalogoId)) {
    return NextResponse.json({ error: "Catálogo inválido." }, { status: 400 });
  }

  const escopos = listarEscoposCatalogoN1(catalogoId);
  return NextResponse.json({ catalogoId, escopos });
}
