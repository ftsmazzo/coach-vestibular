import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { normalizarAreaBloco } from "@/lib/areas-bloco";
import { concederXp, XP_VALORES } from "@/lib/xp";
import { enviarNotificacao, telefoneParaWhatsapp } from "@/lib/notificacoes";
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
          xpConcedido: XP_VALORES.SUGESTAO_ACEITA,
          respostaAdmin: body.respostaAdmin?.trim() || "Classificação ajustada. Obrigado pela colaboração!",
          reviewedAt: new Date(),
        },
      });
    });

    const { ganhou: xp } = await concederXp(
      sugestao.userId,
      "SUGESTAO_ACEITA",
      id,
      XP_VALORES.SUGESTAO_ACEITA
    );

    const aluno = await prisma.user.findUnique({
      where: { id: sugestao.userId },
      select: { name: true, telefone: true, email: true },
    });
    if (aluno) {
      const primeiroNome = aluno.name.split(/\s+/)[0] || "você";
      const numero = telefoneParaWhatsapp(aluno.telefone);
      const mensagem = numero
        ? `Oi, ${primeiroNome}! ✅ Sua correção de classificação (questão ${sugestao.numero}) foi aceita${xp > 0 ? ` — +${xp} XP!` : "!"} Obrigado por deixar o banco mais preciso. 🙌`
        : `(Aluno sem WhatsApp) ${aluno.name}: classificação da questão ${sugestao.numero} aceita${xp > 0 ? ` (+${xp} XP)` : ""}`;
      await enviarNotificacao({
        evento: "classificacao_aceita",
        numero,
        mensagem,
        meta: { sugestaoId: id, aluno: aluno.email },
      });
    }

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
