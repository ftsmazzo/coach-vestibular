import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { refreshProvaGabaritoFlag } from "@/lib/prova-attempt";
import { executarPipelineProvaV2 } from "@/lib/prova-pipeline-v2";
import { persistirQuestoesClassificadas, chaveObservacaoQuestao } from "@/lib/prova-questoes-persist";

export const maxDuration = 600;

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
  let aplicar = true;
  let substituir = true;
  let incluirGabarito = false;
  let incluirBlocoEspanhol = false;
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
    aplicar = form.get("aplicar") !== "false";
    substituir = form.get("substituir") !== "false";
    incluirGabarito = form.get("incluirGabarito") === "true";
    incluirBlocoEspanhol = form.get("incluirBlocoEspanhol") === "true";
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
        aplicar: z.boolean().default(true),
        substituir: z.boolean().default(true),
        incluirGabarito: z.boolean().default(false),
        incluirBlocoEspanhol: z.boolean().default(false),
        excluirBlocoEspanhol: z.boolean().default(false),
        gabarito: z.string().optional(),
        pdfBase64: z.string().optional(),
      })
      .parse(await request.json());
    aplicar = body.aplicar;
    substituir = body.substituir;
    incluirGabarito = body.incluirGabarito;
    incluirBlocoEspanhol = body.incluirBlocoEspanhol;
    excluirBlocoEspanhol = body.excluirBlocoEspanhol;
    gabaritoTexto = body.gabarito?.trim() ?? "";
    if (body.pdfBase64) {
      pdfBuffer = Buffer.from(body.pdfBase64, "base64");
    }
    if (!pdfBuffer) {
      return NextResponse.json({ error: "Envie o PDF." }, { status: 400 });
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
        tipo: prova.tipo,
        ano: prova.ano,
        dia: prova.dia,
        caderno: prova.caderno,
        descricao: prova.descricao,
        totalEsperado: prova.totalQuestoes,
      },
      {
        gabaritoTexto,
        incluirGabarito,
        incluirBlocoEspanhol,
        excluirBlocoEspanhol,
        gerarCsv: !aplicar,
      }
    );

    if (resultado.rows.length === 0) {
      return NextResponse.json(
        {
          error:
            "Nenhuma questão classificada. Confira o PDF (texto selecionável), o total de questões no cadastro e se o arquivo corresponde à prova.",
          avisos: resultado.avisos,
          etapas: resultado.etapas,
        },
        { status: 422 }
      );
    }

    let gravadas = 0;
    if (aplicar) {
      const antigas = await prisma.provaQuestao.findMany({
        where: { provaId },
        select: { numero: true, idiomaVariante: true, observacoes: true },
      });
      const obsHumana = new Map(
        antigas
          .filter((a) => a.observacoes?.trim())
          .map((a) => [chaveObservacaoQuestao(a), a.observacoes!.trim()])
      );
      const rowsComHints =
        obsHumana.size > 0
          ? resultado.rows.map((r) => ({
              ...r,
              observacoes: obsHumana.get(chaveObservacaoQuestao(r)) ?? r.observacoes,
            }))
          : resultado.rows;

      gravadas = await persistirQuestoesClassificadas(provaId, rowsComHints, {
        substituir,
      });

      if (resultado.politicaIdiomas === "DUPLICATA_EN_ES" && resultado.faixaIdioma) {
        await prisma.prova.update({
          where: { id: provaId },
          data: {
            politicaIdiomas: "DUPLICATA_EN_ES",
            idiomaQuestaoInicio: resultado.faixaIdioma.inicio,
            idiomaQuestaoFim: resultado.faixaIdioma.fim,
          },
        });
      } else if (resultado.politicaIdiomas === "NENHUMA") {
        await prisma.prova.update({
          where: { id: provaId },
          data: {
            politicaIdiomas: "NENHUMA",
            idiomaQuestaoInicio: null,
            idiomaQuestaoFim: null,
          },
        });
      }

      await refreshProvaGabaritoFlag(provaId);
    }

    return NextResponse.json({
      aplicado: aplicar,
      gravadas,
      totalClassificadas: resultado.rows.length,
      totalEsperado: prova.totalQuestoes,
      modeloUsado: resultado.modeloUsado,
      avisos: resultado.avisos,
      etapas: resultado.etapas,
      rows: aplicar ? undefined : resultado.rows,
      csv: resultado.csv || undefined,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro no pipeline";
    console.error(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
