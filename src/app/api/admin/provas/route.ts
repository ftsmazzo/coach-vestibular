import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { buildProvaNome } from "@/lib/prova-nome";
import { statsQuestoesProva } from "@/lib/prova-stats";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const provas = await prisma.prova.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      questoes: { select: { numero: true, idiomaVariante: true } },
      _count: { select: { questoes: true, tentativas: true } },
    },
  });

  return NextResponse.json(
    provas.map((p) => {
      const stats = statsQuestoesProva(p.questoes, p.totalQuestoes, {
        dia: p.dia,
        banca: p.banca,
        politicaIdiomas: p.politicaIdiomas,
        idiomaQuestaoInicio: p.idiomaQuestaoInicio,
        idiomaQuestaoFim: p.idiomaQuestaoFim,
      });
      return {
        id: p.id,
        nome: p.nome,
        banca: p.banca,
        tipo: p.tipo,
        ano: p.ano,
        dia: p.dia,
        caderno: p.caderno,
        totalQuestoes: p.totalQuestoes,
        publicada: p.publicada,
        gabaritoCompleto: p.gabaritoCompleto,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        _count: p._count,
        questoesCadastradas: stats.cadastradas,
        maiorNumeroQuestao: stats.maiorNumero,
        questoesFaltando: stats.faltando,
        bancoIncompleto: stats.incompleto,
      };
    })
  );
}

const createSchema = z.object({
  nome: z.string().optional(),
  banca: z.string().default("ENEM"),
  tipo: z.enum(["ENEM_OFICIAL", "SIMULADO", "VESTIBULAR", "OUTRO"]).default("SIMULADO"),
  ano: z.number().int().optional(),
  dia: z.number().int().optional(),
  caderno: z.string().optional(),
  descricao: z.string().optional(),
  totalQuestoes: z.number().int().positive(),
  publicada: z.boolean().optional(),
});

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const body = createSchema.parse(await request.json());
  const nome =
    body.nome?.trim() ||
    buildProvaNome({
      banca: body.banca,
      ano: body.ano,
      dia: body.dia,
      caderno: body.caderno,
    });
  const prova = await prisma.prova.create({
    data: { ...body, nome },
  });
  return NextResponse.json(prova);
}
