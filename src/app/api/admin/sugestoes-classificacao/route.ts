import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const sugestoes = await prisma.sugestaoClassificacao.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      user: { select: { id: true, name: true, email: true, xp: true } },
      exam: { select: { id: true, nome: true, provaId: true } },
    },
    take: 100,
  });

  return NextResponse.json(
    sugestoes.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      reviewedAt: s.reviewedAt?.toISOString() ?? null,
    }))
  );
}
