import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { normalizarAreaBloco } from "@/lib/areas-bloco";
import { prisma } from "@/lib/prisma";

/** Converte areaBloco legado (UFU, ENEM longo…) para os 4 rótulos internos. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id: provaId } = await params;

  const questoes = await prisma.provaQuestao.findMany({
    where: { provaId },
    select: { id: true, numero: true, areaBloco: true, materia: true },
  });

  let atualizadas = 0;
  for (const q of questoes) {
    const nova = normalizarAreaBloco(q.areaBloco, q.materia);
    if (nova === q.areaBloco || (!nova && !q.areaBloco)) continue;
    await prisma.provaQuestao.update({
      where: { id: q.id },
      data: { areaBloco: nova },
    });
    atualizadas++;
  }

  return NextResponse.json({
    ok: true,
    total: questoes.length,
    atualizadas,
    mensagem:
      atualizadas > 0
        ? `${atualizadas} questão(ões) com área padronizada.`
        : "Todas as áreas já estão no padrão interno.",
  });
}
