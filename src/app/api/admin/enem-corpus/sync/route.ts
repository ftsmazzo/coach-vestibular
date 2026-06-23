import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { sincronizarCorpusEnem } from "@/lib/enem-corpus-sync";
import { obterStatsCorpusEnem } from "@/lib/enem-corpus-stats";
import { validarCorpusEstruturalBanco } from "@/lib/enem-corpus-validacao";
import { prisma } from "@/lib/prisma";

export const maxDuration = 600;

const syncSchema = z.object({
  ano: z.number().int().min(2009).max(2030).optional(),
  dryRun: z.boolean().optional(),
});

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const body = syncSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  try {
    const resultado = await sincronizarCorpusEnem(prisma, {
      anos: body.data.ano ? [body.data.ano] : undefined,
      dryRun: body.data.dryRun ?? false,
    });

    const [stats, estrutural] = await Promise.all([
      obterStatsCorpusEnem(prisma, "linguagens"),
      validarCorpusEstruturalBanco(prisma),
    ]);

    return NextResponse.json({
      resultado,
      stats,
      estrutural,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro na sincronização";
    console.error("[enem-corpus/sync] POST", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const estrutural = await validarCorpusEstruturalBanco(prisma);
  return NextResponse.json({ estrutural });
}
