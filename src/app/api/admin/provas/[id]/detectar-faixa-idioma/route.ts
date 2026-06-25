import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { proporFaixaIdiomaPorConteudo } from "@/lib/prova-idioma";

const bodySchema = z.object({
  aplicar: z.boolean().optional(),
  inicio: z.number().int().positive().optional(),
  fim: z.number().int().positive().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id: provaId } = await params;
  const prova = await prisma.prova.findUnique({
    where: { id: provaId },
    include: {
      questoes: {
        where: { idiomaVariante: "COMUM" },
        orderBy: { numero: "asc" },
        select: { numero: true, enunciado: true, alternativas: true },
      },
    },
  });
  if (!prova) return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });

  const body = bodySchema.safeParse(await request.json().catch(() => ({}))).data ?? {};

  const propostaManual =
    body.inicio != null && body.fim != null && body.fim >= body.inicio
      ? {
          faixa: { inicio: body.inicio, fim: body.fim },
          confianca: "alta" as const,
          motivo: "faixa definida manualmente pelo admin",
          numerosEstrangeiros: [] as number[],
        }
      : null;

  const proposta =
    propostaManual ??
    proporFaixaIdiomaPorConteudo(prova.questoes, {
      banca: prova.banca,
      totalEsperado: prova.totalQuestoes,
    });

  if (!proposta) {
    return NextResponse.json(
      {
        error:
          "Não foi possível inferir faixa EN/ES pelo conteúdo. Defina início/fim manualmente ou reextraia o PDF.",
      },
      { status: 422 }
    );
  }

  if (body.aplicar) {
    await prisma.prova.update({
      where: { id: provaId },
      data: {
        politicaIdiomas: "DUPLICATA_EN_ES",
        idiomaQuestaoInicio: proposta.faixa.inicio,
        idiomaQuestaoFim: proposta.faixa.fim,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    aplicado: Boolean(body.aplicar),
    proposta,
  });
}
