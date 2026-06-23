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
import {
  LINGUAGENS_ROTA_VERSION,
  repararIdiomaLinguagensCorpus,
} from "@/lib/enem-repair-linguagens";
import { importarL2InglesCorpus } from "@/lib/enem-import-l2-ingles";
import { prisma } from "@/lib/prisma";

export const maxDuration = 600;

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
    linguagensRotaVersion: LINGUAGENS_ROTA_VERSION,
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
  repairLinguagensIdioma: z.boolean().optional(),
  /** Só corrige idioma Q1–5 (Linguagens), sem classificar. */
  soRepararIdioma: z.boolean().optional(),
  importarLinguagensIngles: z.boolean().optional(),
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

  try {
    let repair: Awaited<ReturnType<typeof repararIdiomaLinguagensCorpus>> | null = null;
    let importL2: Awaited<ReturnType<typeof importarL2InglesCorpus>> | null = null;

    if (body.data.importarLinguagensIngles && materiaId === "linguagens") {
      importL2 = await importarL2InglesCorpus(prisma);
    }

    if (
      (body.data.repairLinguagensIdioma || body.data.soRepararIdioma) &&
      materiaId === "linguagens"
    ) {
      repair = await repararIdiomaLinguagensCorpus(prisma);
    }

    if (body.data.soRepararIdioma || body.data.importarLinguagensIngles) {
      const [stats, fila] = await Promise.all([
        obterStatsCorpusEnem(prisma, materiaId),
        listarFilaRevisaoEnem(prisma, materiaId, 15),
      ]);
      return NextResponse.json({
        stats,
        fila,
        materiaId,
        repair,
        importL2,
        soRepararIdioma: Boolean(body.data.soRepararIdioma),
        importarLinguagensIngles: Boolean(body.data.importarLinguagensIngles),
      });
    }

    const resultado = await classificarCorpusEnem(prisma, {
      ...body.data,
      materiaId,
      persistir: true,
    });

    const [stats, fila] = await Promise.all([
      obterStatsCorpusEnem(prisma, materiaId),
      listarFilaRevisaoEnem(prisma, materiaId, 15),
    ]);

    return NextResponse.json({ resultado, stats, fila, materiaId, repair, importL2 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro na classificação";
    console.error("[enem-corpus] POST", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
