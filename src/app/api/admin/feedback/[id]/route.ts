import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { enviarNotificacao, telefoneParaWhatsapp } from "@/lib/notificacoes";

const patchSchema = z.object({
  status: z.enum(["NOVO", "EM_ANALISE", "RESOLVIDO", "ARQUIVADO"]).optional(),
  notaAdmin: z.string().max(4000).optional().nullable(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = patchSchema.parse(await request.json());

  const existing = await prisma.feedback.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!existing) return NextResponse.json({ error: "Report não encontrado" }, { status: 404 });

  const feedback = await prisma.feedback.update({
    where: { id },
    data: {
      status: body.status,
      notaAdmin: body.notaAdmin === undefined ? undefined : body.notaAdmin,
    },
    include: { user: { select: { name: true, telefone: true, email: true } } },
  });

  // Avisa o aluno quando o report dele é resolvido/acatado (ambiente de cooperação).
  if (body.status === "RESOLVIDO" && existing.status !== "RESOLVIDO") {
    const primeiroNome = feedback.user.name.split(/\s+/)[0] || "você";
    const numero = telefoneParaWhatsapp(feedback.user.telefone);
    const ehBug = feedback.tipo === "BUG";
    const mensagem = numero
      ? ehBug
        ? `Oi, ${primeiroNome}! 🛠️ O problema que você reportou — "${feedback.titulo}" — foi resolvido. Valeu por ajudar a deixar o Coach melhor! 💛`
        : `Oi, ${primeiroNome}! 💡 Sua sugestão "${feedback.titulo}" foi acatada e já entrou no Coach. Obrigado por construir isso com a gente! 🚀`
      : `(Aluno sem WhatsApp) ${feedback.user.name}: ${ehBug ? "bug resolvido" : "sugestão acatada"} — "${feedback.titulo}"`;

    await enviarNotificacao({
      evento: ehBug ? "bug_resolvido" : "sugestao_acatada",
      numero,
      mensagem,
      meta: { feedbackId: feedback.id, aluno: feedback.user.email },
    });
  }

  return NextResponse.json({ ok: true, status: feedback.status });
}
