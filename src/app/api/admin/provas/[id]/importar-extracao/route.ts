import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { refreshProvaGabaritoFlag } from "@/lib/prova-attempt";
import {
  montarTextoFonteDeRows,
  persistirQuestoesExtracaoProva,
  persistirTextoFonteProva,
} from "@/lib/prova-questoes-persist";
import { montarRelatorioExtracaoComCobertura, resumoExtracao } from "@/lib/prova-extracao-relatorio";
import { prisma } from "@/lib/prisma";
import { n8nItensParaRows, type N8nQuestaoExtraida } from "@/lib/prova-atribuir-area-bloco";

export const maxDuration = 120;

const itemSchema = z.object({
  indice_global: z.number().int().positive().optional().nullable(),
  numero: z.number().int().positive(),
  secao: z.string().optional().nullable(),
  opcao_lingua_estrangeira: z.string().optional().nullable(),
  enunciado: z.string().optional().nullable(),
  alternativas: z.union([z.record(z.string(), z.string()), z.string()]).optional().nullable(),
  texto_base_anterior: z.string().optional().nullable(),
  valido: z.boolean().optional(),
  precisa_revisao_imagem: z.boolean().optional(),
});

const bodySchema = z.object({
  fonte: z.enum(["n8n"]).default("n8n"),
  questoes: z.array(itemSchema).min(1),
  substituir: z.boolean().default(true),
});

/** Importa extração externa (n8n webhook) no mesmo contrato do Pipeline V2. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id: provaId } = await params;
  const prova = await prisma.prova.findUnique({ where: { id: provaId } });
  if (!prova) {
    return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });
  }

  const body = bodySchema.parse(await request.json());
  const rows = n8nItensParaRows(body.questoes as N8nQuestaoExtraida[]);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Nenhuma questão válida no payload." }, { status: 422 });
  }

  try {
    const gravadas = await persistirQuestoesExtracaoProva(provaId, rows, {
      substituir: body.substituir,
    });
    await persistirTextoFonteProva(provaId, montarTextoFonteDeRows(rows));
    await refreshProvaGabaritoFlag(provaId);

    const provaAtual = await prisma.prova.findUnique({
      where: { id: provaId },
      include: { questoes: true },
    });
    const relatorio = provaAtual
      ? montarRelatorioExtracaoComCobertura(provaAtual.questoes, provaAtual)
      : null;

    const comArea = rows.filter((r) => r.areaBloco?.trim()).length;
    const revisaoImagem = (body.questoes as N8nQuestaoExtraida[]).filter(
      (q) => q.precisa_revisao_imagem
    ).length;

    return NextResponse.json({
      ok: true,
      fonte: body.fonte,
      gravadas,
      totalRecebidas: body.questoes.length,
      comAreaBloco: comArea,
      revisaoImagem,
      avisos: [
        ...(comArea < rows.length
          ? [
              `${rows.length - comArea} questão(ões) sem área — use «Atribuir áreas do PDF» ou confira o campo secao no n8n.`,
            ]
          : []),
        ...(revisaoImagem > 0
          ? [
              `${revisaoImagem} questão(ões) com texto incompleto — revise enunciado/alternativas no banco.`,
            ]
          : []),
      ],
      ...(relatorio
        ? { resumoExtracao: resumoExtracao(relatorio), relatorio }
        : {}),
      mensagem: `Importadas ${gravadas} questão(ões) via ${body.fonte}.`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao importar extração";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
