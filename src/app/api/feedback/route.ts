import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveFeedbackAnexo } from "@/lib/upload-storage";
import { enviarFeedbackWebhook } from "@/lib/feedback-webhook";
import type { FeedbackTipo } from "@/generated/prisma/client";

const MAX_MB = 8;
const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const TIPOS: FeedbackTipo[] = ["BUG", "SUGESTAO", "DUVIDA"];

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const formData = await request.formData();
  const tipoRaw = ((formData.get("tipo") as string) || "BUG").toUpperCase();
  const tipo: FeedbackTipo = TIPOS.includes(tipoRaw as FeedbackTipo)
    ? (tipoRaw as FeedbackTipo)
    : "BUG";
  const titulo = ((formData.get("titulo") as string) || "").trim();
  const descricao = ((formData.get("descricao") as string) || "").trim();
  const esperado = ((formData.get("esperado") as string) || "").trim();
  const severidade = ((formData.get("severidade") as string) || "").trim();
  const pagina = ((formData.get("pagina") as string) || "").trim();
  const contextoRaw = ((formData.get("contexto") as string) || "").trim();
  const anexo = formData.get("anexo") as File | null;

  if (titulo.length < 3) {
    return NextResponse.json({ error: "Dê um título curto ao report." }, { status: 400 });
  }
  if (descricao.length < 5) {
    return NextResponse.json({ error: "Descreva um pouco mais o que aconteceu." }, { status: 400 });
  }

  let contexto: Record<string, unknown> | null = null;
  if (contextoRaw) {
    try {
      contexto = JSON.parse(contextoRaw) as Record<string, unknown>;
    } catch {
      contexto = { raw: contextoRaw.slice(0, 500) };
    }
  }
  if (contexto) {
    contexto.versaoApp = process.env.APP_COMMIT ?? process.env.VERCEL_GIT_COMMIT_SHA ?? null;
  }

  const temAnexo = anexo && anexo.size > 0;
  if (temAnexo) {
    if (!ALLOWED.includes(anexo.type)) {
      return NextResponse.json({ error: "Anexo deve ser imagem ou PDF." }, { status: 400 });
    }
    if (anexo.size > MAX_MB * 1024 * 1024) {
      return NextResponse.json({ error: `Anexo muito grande (máx. ${MAX_MB} MB).` }, { status: 400 });
    }
  }

  const feedback = await prisma.feedback.create({
    data: {
      userId: session.userId,
      tipo,
      titulo,
      descricao,
      esperado: esperado || null,
      severidade: severidade || null,
      pagina: pagina || null,
      contextoJson: contexto ? JSON.stringify(contexto) : null,
    },
  });

  if (temAnexo) {
    try {
      const anexoPath = await saveFeedbackAnexo(feedback.id, anexo);
      await prisma.feedback.update({
        where: { id: feedback.id },
        data: { anexoPath, anexoFileName: anexo.name, anexoMimeType: anexo.type },
      });
    } catch (e) {
      console.error("[feedback] falha ao salvar anexo:", e);
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true, email: true },
  });

  const origin = new URL(request.url).origin;
  await enviarFeedbackWebhook({
    id: feedback.id,
    tipo,
    status: "NOVO",
    titulo,
    descricao,
    esperado: esperado || null,
    severidade: severidade || null,
    pagina: pagina || null,
    contexto,
    temAnexo: Boolean(temAnexo),
    aluno: {
      id: session.userId,
      nome: user?.name ?? "—",
      email: user?.email ?? "—",
    },
    criadoEm: feedback.createdAt.toISOString(),
    appUrl: `${origin}/admin/feedback`,
  });

  return NextResponse.json({
    ok: true,
    id: feedback.id,
    mensagem: "Obrigado! Seu report foi enviado para a equipe. 💛",
  });
}
