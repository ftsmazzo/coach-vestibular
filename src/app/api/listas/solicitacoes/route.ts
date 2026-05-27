import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_MB = 12;

/**
 * Aluno solicita inclusão de simulado no catálogo (PDF/foto).
 * Admin processa depois no pipeline existente — sem publicação automática.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const nome = ((formData.get("nome") as string) || "").trim();
  const banca = ((formData.get("banca") as string) || "").trim();
  const observacao = ((formData.get("observacao") as string) || "").trim();

  if (!nome) {
    return NextResponse.json({ error: "Informe o nome do simulado." }, { status: 400 });
  }
  if (!file) {
    return NextResponse.json({ error: "Anexe o PDF ou foto da prova." }, { status: 400 });
  }

  const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    return NextResponse.json(
      { error: "Formato não suportado. Use PDF ou imagem." },
      { status: 400 }
    );
  }
  if (file.size > MAX_MB * 1024 * 1024) {
    return NextResponse.json({ error: `Arquivo muito grande (máx. ${MAX_MB} MB).` }, { status: 400 });
  }

  const job = await prisma.uploadJob.create({
    data: {
      userId: session.userId,
      fileName: file.name,
      status: "solicitacao_simulado",
      resultJson: JSON.stringify({
        tipo: "SOLICITACAO_SIMULADO",
        nome,
        banca: banca || null,
        observacao: observacao || null,
        tamanhoBytes: file.size,
        mimeType: file.type,
        mensagem:
          "Solicitação recebida. Quando o simulado for publicado em Atividades, você poderá registrar seu resultado.",
      }),
    },
  });

  return NextResponse.json({
    ok: true,
    jobId: job.id,
    mensagem:
      "Solicitação enviada! A equipe analisa o material e, se possível, publica no catálogo de Atividades.",
  });
}
