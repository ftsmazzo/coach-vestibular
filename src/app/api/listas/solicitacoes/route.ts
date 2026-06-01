import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  STATUS_SOLICITACAO_PENDENTE,
  STATUS_SOLICITACAO_PROCESSADA,
  parseSolicitacaoMeta,
} from "@/lib/solicitacao-simulado";
import { saveSolicitacaoFile, saveSolicitacaoGabarito } from "@/lib/upload-storage";

const MAX_MB = 12;
const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

/**
 * Aluno solicita inclusão de simulado no catálogo (PDF/foto).
 * Admin vê em /admin/solicitacoes e baixa o arquivo.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const gabaritoFile = formData.get("gabaritoFile") as File | null;
  const gabaritoTexto = ((formData.get("gabaritoTexto") as string) || "").trim();
  const nome = ((formData.get("nome") as string) || "").trim();
  const banca = ((formData.get("banca") as string) || "").trim();
  const observacao = ((formData.get("observacao") as string) || "").trim();

  if (!nome) {
    return NextResponse.json({ error: "Informe o nome do simulado." }, { status: 400 });
  }
  if (!file) {
    return NextResponse.json({ error: "Anexe o PDF ou foto da prova." }, { status: 400 });
  }

  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json(
      { error: "Formato não suportado. Use PDF ou imagem." },
      { status: 400 }
    );
  }
  if (file.size > MAX_MB * 1024 * 1024) {
    return NextResponse.json({ error: `Arquivo muito grande (máx. ${MAX_MB} MB).` }, { status: 400 });
  }

  const temGabaritoFile = gabaritoFile && gabaritoFile.size > 0;
  if (temGabaritoFile) {
    if (!ALLOWED.includes(gabaritoFile.type)) {
      return NextResponse.json(
        { error: "Formato do gabarito não suportado. Use PDF ou imagem." },
        { status: 400 }
      );
    }
    if (gabaritoFile.size > MAX_MB * 1024 * 1024) {
      return NextResponse.json(
        { error: `Gabarito muito grande (máx. ${MAX_MB} MB).` },
        { status: 400 }
      );
    }
  }

  const job = await prisma.uploadJob.create({
    data: {
      userId: session.userId,
      fileName: file.name,
      status: STATUS_SOLICITACAO_PENDENTE,
      resultJson: JSON.stringify({
        tipo: "SOLICITACAO_SIMULADO",
        nome,
        banca: banca || null,
        observacao: observacao || null,
        tamanhoBytes: file.size,
        mimeType: file.type,
        gabaritoTexto: gabaritoTexto || null,
        mensagem:
          "Solicitação recebida. Quando o simulado for publicado em Atividades, você poderá registrar seu resultado.",
      }),
    },
  });

  let storagePath: string;
  try {
    storagePath = await saveSolicitacaoFile(job.id, file);
  } catch (e) {
    await prisma.uploadJob.delete({ where: { id: job.id } });
    console.error("[solicitacoes] falha ao salvar arquivo:", e);
    return NextResponse.json(
      { error: "Não foi possível salvar o arquivo. Tente novamente." },
      { status: 500 }
    );
  }

  let gabaritoStoragePath: string | null = null;
  if (temGabaritoFile) {
    try {
      gabaritoStoragePath = await saveSolicitacaoGabarito(job.id, gabaritoFile);
    } catch (e) {
      console.error("[solicitacoes] falha ao salvar gabarito:", e);
      // não bloqueia a solicitação — o gabarito é opcional
    }
  }

  const metaFinal = {
    tipo: "SOLICITACAO_SIMULADO",
    nome,
    banca: banca || null,
    observacao: observacao || null,
    tamanhoBytes: file.size,
    mimeType: file.type,
    gabaritoTexto: gabaritoTexto || null,
    gabaritoStoragePath,
    gabaritoFileName: gabaritoStoragePath && temGabaritoFile ? gabaritoFile.name : null,
    gabaritoMimeType: gabaritoStoragePath && temGabaritoFile ? gabaritoFile.type : null,
    gabaritoTamanhoBytes: gabaritoStoragePath && temGabaritoFile ? gabaritoFile.size : null,
    mensagem:
      "Solicitação recebida. Quando o simulado for publicado em Atividades, você poderá registrar seu resultado.",
  };

  await prisma.uploadJob.update({
    where: { id: job.id },
    data: { storagePath, resultJson: JSON.stringify(metaFinal) },
  });

  const comGabarito = Boolean(gabaritoTexto) || Boolean(gabaritoStoragePath);

  return NextResponse.json({
    ok: true,
    jobId: job.id,
    mensagem: comGabarito
      ? "Solicitação enviada com o gabarito! Isso acelera a publicação no catálogo de Atividades."
      : "Solicitação enviada! A equipe analisa o material e, se possível, publica no catálogo de Atividades.",
  });
}

/** Lista solicitações do aluno logado (opcional, para histórico futuro). */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const jobs = await prisma.uploadJob.findMany({
    where: {
      userId: session.userId,
      status: { in: [STATUS_SOLICITACAO_PENDENTE, STATUS_SOLICITACAO_PROCESSADA] },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      fileName: true,
      status: true,
      createdAt: true,
      resultJson: true,
      storagePath: true,
    },
  });

  return NextResponse.json(
    jobs.map((j) => ({
      id: j.id,
      fileName: j.fileName,
      status: j.status,
      createdAt: j.createdAt.toISOString(),
      temArquivo: Boolean(j.storagePath),
      ...parseSolicitacaoMeta(j.resultJson),
    }))
  );
}
