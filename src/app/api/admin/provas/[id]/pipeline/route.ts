import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { refreshProvaGabaritoFlag } from "@/lib/prova-attempt";
import { executarPipelineProvaV2 } from "@/lib/prova-pipeline-v2";
import type { ProvaQuestaoRow } from "@/lib/parse-prova-csv";

export const maxDuration = 600;

async function persistirRows(
  provaId: string,
  rows: ProvaQuestaoRow[],
  substituir: boolean
): Promise<number> {
  if (substituir) {
    await prisma.provaQuestao.deleteMany({ where: { provaId } });
  }
  let n = 0;
  for (const r of rows) {
    await prisma.provaQuestao.upsert({
      where: { provaId_numero: { provaId, numero: r.numero } },
      create: {
        provaId,
        numero: r.numero,
        areaBloco: r.areaBloco ?? null,
        materia: r.materia,
        assunto: r.assunto,
        conhecimentoExigido: r.conhecimentoExigido ?? null,
        nivelDificuldade: r.nivelDificuldade ?? null,
        observacoes: r.observacoes ?? null,
        enunciado: r.enunciado ?? null,
        gabarito: r.gabarito?.toUpperCase() ?? null,
      },
      update: {
        areaBloco: r.areaBloco ?? null,
        materia: r.materia,
        assunto: r.assunto,
        conhecimentoExigido: r.conhecimentoExigido ?? null,
        nivelDificuldade: r.nivelDificuldade ?? null,
        observacoes: r.observacoes ?? null,
        ...(r.enunciado ? { enunciado: r.enunciado } : {}),
        ...(r.gabarito ? { gabarito: r.gabarito.toUpperCase() } : {}),
      },
    });
    n++;
  }
  return n;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id: provaId } = await params;
  const prova = await prisma.prova.findUnique({ where: { id: provaId } });
  if (!prova) return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });

  const contentType = request.headers.get("content-type") ?? "";
  let aplicar = false;
  let substituir = true;
  let incluirGabarito = false;
  let excluirBlocoEspanhol = false;
  let gabaritoTexto = "";
  let pdfBuffer: Buffer | null = null;

  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "Não foi possível ler o PDF enviado." },
        { status: 413 }
      );
    }
    aplicar = form.get("aplicar") === "true";
    substituir = form.get("substituir") !== "false";
    incluirGabarito = form.get("incluirGabarito") === "true";
    excluirBlocoEspanhol = form.get("excluirBlocoEspanhol") === "true";
    gabaritoTexto = String(form.get("gabarito") ?? "").trim();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Envie o PDF da prova." }, { status: 400 });
    }
    pdfBuffer = Buffer.from(await file.arrayBuffer());
  } else {
    const body = z
      .object({
        aplicar: z.boolean().default(false),
        substituir: z.boolean().default(true),
        incluirGabarito: z.boolean().default(false),
        excluirBlocoEspanhol: z.boolean().default(false),
        gabarito: z.string().optional(),
        pdfBase64: z.string().optional(),
      })
      .parse(await request.json());
    aplicar = body.aplicar;
    substituir = body.substituir;
    incluirGabarito = body.incluirGabarito;
    excluirBlocoEspanhol = body.excluirBlocoEspanhol;
    gabaritoTexto = body.gabarito?.trim() ?? "";
    if (body.pdfBase64) {
      pdfBuffer = Buffer.from(body.pdfBase64, "base64");
    }
    if (!pdfBuffer) {
      return NextResponse.json({ error: "Envie o PDF (multipart ou pdfBase64)." }, { status: 400 });
    }
  }

  if (!pdfBuffer.length) {
    return NextResponse.json({ error: "Arquivo PDF vazio." }, { status: 400 });
  }

  try {
    const resultado = await executarPipelineProvaV2(
      pdfBuffer,
      {
        nome: prova.nome,
        banca: prova.banca,
        ano: prova.ano,
        caderno: prova.caderno,
        totalEsperado: prova.totalQuestoes,
        tipoProva: prova.tipo,
      },
      {
        gabaritoTexto,
        incluirGabarito,
        excluirBlocoEspanhol,
      }
    );

    let gravadas = 0;
    if (resultado.rows.length === 0) {
      return NextResponse.json(
        {
          error:
            "Nenhuma questão classificada. Confira o PDF (texto selecionável) ou marque «Ignorar Espanhol» se aplicável.",
          avisos: resultado.avisos,
          etapas: resultado.etapas,
        },
        { status: 422 }
      );
    }

    if (aplicar) {
      gravadas = await persistirRows(provaId, resultado.rows, substituir);
      await refreshProvaGabaritoFlag(provaId);
    }

    return NextResponse.json({
      ...resultado,
      aplicado: aplicar,
      gravadas,
      totalEsperado: prova.totalQuestoes,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro no pipeline";
    console.error(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
