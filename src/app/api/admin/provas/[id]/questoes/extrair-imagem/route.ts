import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { extrairQuestaoDeArquivo } from "@/lib/extrair-questao-imagem";
import { prisma } from "@/lib/prisma";

const MAX_MB = 12;
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
    select: { id: true, nome: true, banca: true },
  });

  if (!prova) {
    return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json(
      {
        error:
          "Leitura por imagem não disponível (OPENAI_API_KEY). Preencha manualmente.",
      },
      { status: 503 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Anexe uma foto ou PDF da questão." }, { status: 400 });
  }

  if (!ALLOWED.includes(file.type as (typeof ALLOWED)[number])) {
    return NextResponse.json(
      { error: "Formato não suportado. Use JPEG, PNG, WebP ou PDF." },
      { status: 400 }
    );
  }

  if (file.size > MAX_MB * 1024 * 1024) {
    return NextResponse.json(
      { error: `Arquivo muito grande (máx. ${MAX_MB} MB).` },
      { status: 400 }
    );
  }

  const numeroRaw = formData.get("numero");
  const numeroEsperado =
    typeof numeroRaw === "string" && numeroRaw.trim()
      ? parseInt(numeroRaw, 10)
      : undefined;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const resultado = await extrairQuestaoDeArquivo({
      buffer,
      fileName: file.name || "questao-print",
      mimeType: file.type,
      numeroEsperado:
        numeroEsperado && Number.isFinite(numeroEsperado) ? numeroEsperado : undefined,
      banca: prova.banca,
      nomeProva: prova.nome,
    });

    return NextResponse.json({
      ok: true,
      ...resultado,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro na leitura";
    console.error("[admin/questoes/extrair-imagem]", e);
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
