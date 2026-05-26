import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { buildProvaNome } from "@/lib/prova-nome";
import { statsQuestoesProva } from "@/lib/prova-stats";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;
  const prova = await prisma.prova.findUnique({
    where: { id },
    include: {
      questoes: { orderBy: { numero: "asc" } },
      _count: { select: { tentativas: true } },
      tentativas: {
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { data: "desc" },
      },
    },
  });
  if (!prova) return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });
  const stats = statsQuestoesProva(prova.questoes, prova.totalQuestoes);
  const { textoFonte, ...provaSemTexto } = prova;
  return NextResponse.json({
    ...provaSemTexto,
    temTextoFonte: Boolean(textoFonte?.trim()),
    tamanhoTextoFonte: textoFonte?.length ?? 0,
    questoesCadastradas: stats.cadastradas,
    maiorNumeroQuestao: stats.maiorNumero,
    questoesFaltando: stats.faltando,
    bancoIncompleto: stats.incompleto,
  });
}

const patchSchema = z.object({
  nome: z.string().optional(),
  banca: z.string().optional(),
  tipo: z.enum(["ENEM_OFICIAL", "SIMULADO", "VESTIBULAR", "OUTRO"]).optional(),
  ano: z.number().int().optional().nullable(),
  dia: z.number().int().optional().nullable(),
  caderno: z.string().optional().nullable(),
  descricao: z.string().optional().nullable(),
  totalQuestoes: z.number().int().positive().optional(),
  publicada: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = patchSchema.parse(await request.json());
  const atual = await prisma.prova.findUnique({ where: { id } });
  if (!atual) return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });

  const merged = {
    banca: body.banca ?? atual.banca,
    ano: body.ano !== undefined ? body.ano : atual.ano,
    dia: body.dia !== undefined ? body.dia : atual.dia,
    caderno: body.caderno !== undefined ? body.caderno : atual.caderno,
  };
  const nome =
    body.nome?.trim() ||
    buildProvaNome({
      banca: merged.banca,
      ano: merged.ano,
      dia: merged.dia,
      caderno: merged.caderno,
    });

  const prova = await prisma.prova.update({
    where: { id },
    data: { ...body, nome },
  });
  return NextResponse.json(prova);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;
  await prisma.prova.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
