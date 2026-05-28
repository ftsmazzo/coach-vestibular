import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  extrairGabaritoAlunoDeArquivo,
  mesclarRespostasExtraidas,
} from "@/lib/extrair-gabarito-aluno";
import { prisma } from "@/lib/prisma";

const MAX_MB = 12;
const MAX_ARQUIVOS = 4;
const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id: provaId } = await params;
  const prova = await prisma.prova.findUnique({
    where: { id: provaId },
    select: {
      id: true,
      nome: true,
      banca: true,
      totalQuestoes: true,
      publicada: true,
      questoes: { select: { numero: true } },
    },
  });

  if (!prova) {
    return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });
  }
  if (!prova.publicada) {
    return NextResponse.json({ error: "Prova não disponível" }, { status: 403 });
  }
  if (prova.questoes.length === 0) {
    return NextResponse.json(
      { error: "Esta prova ainda não tem questões no banco — aguarde o cadastro da equipe." },
      { status: 400 }
    );
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json(
      {
        error:
          "Leitura por foto não está disponível no servidor (OPENAI_API_KEY). Use «Meu gabarito» digitando número,letra.",
      },
      { status: 503 }
    );
  }

  const formData = await request.formData();
  const files = formData
    .getAll("file")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (files.length === 0) {
    return NextResponse.json({ error: "Anexe ao menos um PDF ou foto." }, { status: 400 });
  }
  if (files.length > MAX_ARQUIVOS) {
    return NextResponse.json(
      { error: `Envie no máximo ${MAX_ARQUIVOS} arquivos por vez.` },
      { status: 400 }
    );
  }

  for (const file of files) {
    if (!ALLOWED.includes(file.type as (typeof ALLOWED)[number])) {
      return NextResponse.json(
        { error: "Formato não suportado. Use PDF ou imagem (JPEG, PNG, WebP)." },
        { status: 400 }
      );
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      return NextResponse.json(
        { error: `Arquivo muito grande (máx. ${MAX_MB} MB por arquivo).` },
        { status: 400 }
      );
    }
  }

  try {
    const avisosGerais: string[] = [];
    const porArquivo: Awaited<ReturnType<typeof extrairGabaritoAlunoDeArquivo>>[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      const buffer = Buffer.from(await file.arrayBuffer());
      const resultado = await extrairGabaritoAlunoDeArquivo({
        buffer,
        fileName: file.name || `gabarito-${i + 1}`,
        mimeType: file.type,
        nomeProva: prova.nome,
        totalQuestoes: prova.totalQuestoes,
        banca: prova.banca,
      });
      porArquivo.push(resultado);
      if (files.length > 1) {
        avisosGerais.push(`Arquivo ${i + 1} (${file.name}): ${resultado.respostas.length} resposta(s) lida(s).`);
      }
      avisosGerais.push(...resultado.avisos);
    }

    const respostas = mesclarRespostasExtraidas(porArquivo.map((r) => r.respostas));

    return NextResponse.json({
      ok: true,
      provaId: prova.id,
      totalQuestoes: prova.totalQuestoes,
      respostas,
      avisos: avisosGerais,
      lidas: respostas.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro na leitura";
    console.error("[extrair-gabarito-aluno]", e);
    return NextResponse.json(
      {
        error:
          msg.includes("OPENAI") || msg.includes("Poucas respostas")
            ? msg
            : "Não foi possível ler o gabarito. Tente outra foto ou digite manualmente.",
      },
      { status: 422 }
    );
  }
}
