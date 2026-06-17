import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  extrairGabaritoDeArquivo,
  mesclarRespostasExtraidas,
} from "@/lib/extrair-gabarito-aluno";
import { prisma } from "@/lib/prisma";
import { resolverNumerosGradeProva } from "@/lib/prova-numeracao";

const MAX_MB = 12;
const MAX_ARQUIVOS = 4;
const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id: provaId } = await params;
  const prova = await prisma.prova.findUnique({
    where: { id: provaId },
    select: {
      id: true,
      nome: true,
      banca: true,
      dia: true,
      totalQuestoes: true,
      questoes: { select: { numero: true } },
    },
  });

  if (!prova) {
    return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });
  }
  if (prova.totalQuestoes < 1) {
    return NextResponse.json(
      { error: "Defina o total de questões da prova antes de ler o gabarito." },
      { status: 400 }
    );
  }

  const numerosEsperados = resolverNumerosGradeProva({
    totalQuestoes: prova.totalQuestoes,
    dia: prova.dia,
    banca: prova.banca,
    numerosCadastrados: prova.questoes.map((q) => q.numero),
  });

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json(
      {
        error:
          "Leitura por foto não está disponível no servidor (OPENAI_API_KEY). Use o grid ou cole texto.",
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
    const porArquivo: Awaited<ReturnType<typeof extrairGabaritoDeArquivo>>[] = [];
    const falhas: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const resultado = await extrairGabaritoDeArquivo({
          buffer,
          fileName: file.name || `gabarito-oficial-${i + 1}`,
          mimeType: file.type,
          nomeProva: prova.nome,
          totalQuestoes: prova.totalQuestoes,
          banca: prova.banca,
          modo: "oficial",
          numerosEsperados,
        });
        porArquivo.push(resultado);
        if (files.length > 1) {
          avisosGerais.push(
            `Arquivo ${i + 1} (${file.name}): ${resultado.respostas.length} resposta(s) lida(s).`
          );
        }
        avisosGerais.push(...resultado.avisos);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "falha de leitura";
        falhas.push(`Arquivo ${i + 1} (${file.name}): ${msg}`);
      }
    }

    const respostas = mesclarRespostasExtraidas(porArquivo.map((r) => r.respostas));
    if (falhas.length > 0) {
      avisosGerais.push(...falhas.map((f) => `Aviso: ${f}`));
    }
    if (respostas.length === 0) {
      return NextResponse.json(
        {
          error:
            "Não consegui ler o gabarito oficial na imagem/PDF. Tente foto mais nítida ou preencha no grid.",
          detalhes: falhas,
        },
        { status: 422 }
      );
    }

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
    console.error("[admin/extrair-gabarito]", e);
    return NextResponse.json(
      {
        error:
          msg.includes("OPENAI") || msg.includes("Poucas respostas")
            ? msg
            : "Não foi possível ler o gabarito. Tente outra foto ou preencha no grid.",
      },
      { status: 422 }
    );
  }
}
