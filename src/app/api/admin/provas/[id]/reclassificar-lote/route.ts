import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

export const maxDuration = 60;

/** @deprecated Use /classificar-n1, /classificar-n2, /classificar-n3 em sequência. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id: provaId } = await params;

  return NextResponse.json(
    {
      error:
        "Classificação monolítica desativada. Use as 3 fases separadas: N1 (roteamento) → validar → N2 (escopo) → validar → N3 (conhecimento).",
      provaId,
      endpoints: [
        `/api/admin/provas/${provaId}/classificar-n1`,
        `/api/admin/provas/${provaId}/classificar-n2`,
        `/api/admin/provas/${provaId}/classificar-n3`,
      ],
    },
    { status: 410 }
  );
}
