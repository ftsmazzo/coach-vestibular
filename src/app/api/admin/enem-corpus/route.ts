import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { classificarCorpusEnem } from "@/lib/enem-corpus-classificar";
import {
  listarFilaRevisaoEnem,
  obterStatsCorpusEnem,
} from "@/lib/enem-corpus-stats";
import {
  carregarCatalogoMateria,
  validarCatalogo,
} from "@/lib/conhecimento-catalog";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const [stats, fila] = await Promise.all([
    obterStatsCorpusEnem(prisma),
    listarFilaRevisaoEnem(prisma, 15),
  ]);

  let catalogo: {
    materia: string;
    versao: string;
    totalN2: number;
    validacao: Array<{ nivel: string; ok: boolean; mensagem: string }>;
  } | null = null;

  try {
    const cat = carregarCatalogoMateria("biologia");
    const escopos = cat.assuntos.flatMap((a) =>
      a.dominios.flatMap((d) => d.escopos.filter((e) => !e.deprecated))
    );
    catalogo = {
      materia: cat.materiaLabel,
      versao: cat.catalogVersion ?? cat.schemaVersion,
      totalN2: escopos.length,
      validacao: validarCatalogo(cat).map((v) => ({
        nivel: v.nivel,
        ok: v.ok,
        mensagem: v.mensagem,
      })),
    };
  } catch {
    catalogo = null;
  }

  return NextResponse.json({ stats, fila, catalogo });
}

const classificarSchema = z.object({
  assuntoId: z.string().optional(),
  ano: z.number().int().min(2009).max(2030).optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const body = classificarSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const total = await prisma.enemQuestaoCorpus.count();
  if (total === 0) {
    return NextResponse.json(
      { error: "Corpus vazio — aguarde import ENEM em background ou redeploy." },
      { status: 409 }
    );
  }

  const resultado = await classificarCorpusEnem(prisma, {
    ...body.data,
    persistir: true,
  });

  const stats = await obterStatsCorpusEnem(prisma);

  return NextResponse.json({ resultado, stats });
}
