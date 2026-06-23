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
  MATERIAS_CORPUS,
  validarCatalogo,
  type MateriaCorpusId,
} from "@/lib/conhecimento-catalog";
import { parseMateriaCorpusId } from "@/lib/enem-corpus-materia";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const materiaId = parseMateriaCorpusId(new URL(req.url).searchParams.get("materiaId"));

  const [stats, fila] = await Promise.all([
    obterStatsCorpusEnem(prisma, materiaId),
    listarFilaRevisaoEnem(prisma, materiaId, 15),
  ]);

  let catalogo: {
    materia: string;
    versao: string;
    totalN2: number;
    validacao: Array<{ nivel: string; ok: boolean; mensagem: string }>;
  } | null = null;
  let catalogoErro: string | null = null;

  try {
    const cat = carregarCatalogoMateria(materiaId);
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
  } catch (e) {
    catalogoErro = e instanceof Error ? e.message : "Erro ao carregar catálogo";
  }

  return NextResponse.json({
    stats,
    fila,
    catalogo,
    catalogoErro,
    materiaId,
    materiasDisponiveis: [...MATERIAS_CORPUS],
    iaDisponivel: Boolean(process.env.OPENAI_API_KEY?.trim()),
  });
}

const classificarSchema = z.object({
  materiaId: z
    .enum(["biologia", "quimica", "fisica", "matematica", "humanas", "linguagens"])
    .optional(),
  assuntoId: z.string().optional(),
  ano: z.number().int().min(2009).max(2030).optional(),
  limit: z.number().int().min(1).max(900).optional(),
  soTriagem: z.boolean().optional(),
  retriagem: z.boolean().optional(),
  modo: z.enum(["heuristica", "ia"]).optional(),
});

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const body = classificarSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const materiaId = (body.data.materiaId ?? "biologia") as MateriaCorpusId;

  try {
    carregarCatalogoMateria(materiaId);
  } catch {
    return NextResponse.json(
      { error: `Catálogo ${materiaId} não encontrado.` },
      { status: 404 }
    );
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
    materiaId,
    persistir: true,
  });

  const stats = await obterStatsCorpusEnem(prisma, materiaId);

  return NextResponse.json({ resultado, stats, materiaId });
}
