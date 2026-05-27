import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { normalizarAreaBloco } from "@/lib/areas-bloco";
import { XP_SUGESTAO_ACEITA } from "@/lib/modo-uso";
import { prisma } from "@/lib/prisma";
import {
  normalizarLabelAssunto,
  normalizarLabelMateria,
} from "@/lib/taxonomia-validacao";

const patchSchema = z.object({
  acao: z.enum(["aceitar", "rejeitar"]),
  respostaAdmin: z.string().optional(),
  aplicarNaQuestao: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const body = patchSchema.parse(await request.json());

    const sugestao = await prisma.sugestaoClassificacao.findUnique({
      where: { id },
      include: { provaQuestao: true, exam: true },
    });
    if (!sugestao) {
      return NextResponse.json({ error: "Sugestão não encontrada" }, { status: 404 });
    }
    if (sugestao.status !== "PENDENTE") {
      return NextResponse.json({ error: "Sugestão já revisada" }, { status: 400 });
    }

    if (body.acao === "rejeitar") {
      await prisma.sugestaoClassificacao.update({
        where: { id },
        data: {
          status: "REJEITADA",
          respostaAdmin: body.respostaAdmin?.trim() || null,
          reviewedAt: new Date(),
        },
      });
      return NextResponse.json({ ok: true, status: "REJEITADA" });
    }

    const xp = XP_SUGESTAO_ACEITA;

    await prisma.$transaction(async (tx) => {
      if (
        body.aplicarNaQuestao !== false &&
        sugestao.provaQuestaoId &&
        (sugestao.materiaSugerida || sugestao.assuntoSugerido || sugestao.areaBlocoSugerida)
      ) {
        const materia = sugestao.materiaSugerida
          ? normalizarLabelMateria(sugestao.materiaSugerida)
          : sugestao.provaQuestao?.materia ?? sugestao.materiaAtual;
        const assunto = sugestao.assuntoSugerido
          ? normalizarLabelAssunto(materia, sugestao.assuntoSugerido)
          : sugestao.provaQuestao?.assunto ?? sugestao.assuntoAtual;
        const areaBloco = sugestao.areaBlocoSugerida
          ? normalizarAreaBloco(sugestao.areaBlocoSugerida, materia)
          : sugestao.provaQuestao?.areaBloco;

        await tx.provaQuestao.update({
          where: { id: sugestao.provaQuestaoId },
          data: {
            materia,
            assunto,
            areaBloco: areaBloco ?? undefined,
          },
        });
      }

      await tx.sugestaoClassificacao.update({
        where: { id },
        data: {
          status: "ACEITA",
          xpConcedido: xp,
          respostaAdmin: body.respostaAdmin?.trim() || "Classificação ajustada. Obrigado pela colaboração!",
          reviewedAt: new Date(),
        },
      });

      await tx.user.update({
        where: { id: sugestao.userId },
        data: { xp: { increment: xp } },
      });
    });

    return NextResponse.json({
      ok: true,
      status: "ACEITA",
      xpConcedido: xp,
      mensagem: `Sugestão aceita — +${xp} XP para o aluno.`,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Erro ao revisar sugestão" }, { status: 500 });
  }
}
