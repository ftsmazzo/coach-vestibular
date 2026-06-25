import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { refreshProvaGabaritoFlag } from "@/lib/prova-attempt";
import { executarExtracaoProvaV2 } from "@/lib/prova-pipeline-v2";
import {
  persistirQuestoesExtracaoProva,
  chaveObservacaoQuestao,
  montarTextoFonteDeRows,
  persistirTextoFonteProva,
} from "@/lib/prova-questoes-persist";
import { montarRelatorioExtracao, resumoExtracao } from "@/lib/prova-extracao-relatorio";
import {
  readStoredFile,
  saveProvaCadernoBuffer,
  storedFileExists,
} from "@/lib/upload-storage";

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
  let pdfNome = "prova.pdf";
  let pdfMime = "application/pdf";

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
    const usarCadernoSalvo = form.get("usarCadernoSalvo") === "true";
    const file = form.get("file") as File | null;
    if (file?.size) {
      pdfBuffer = Buffer.from(await file.arrayBuffer());
      pdfNome = file.name || pdfNome;
      pdfMime = file.type || pdfMime;
    } else if (usarCadernoSalvo && prova.cadernoStoragePath) {
      if (!(await storedFileExists(prova.cadernoStoragePath))) {
        return NextResponse.json(
          { error: "Caderno salvo não encontrado no servidor. Envie o PDF de novo." },
          { status: 404 }
        );
      }
      const lido = await readStoredFile(prova.cadernoStoragePath);
      pdfBuffer = lido.buffer;
      pdfNome = prova.cadernoFileName ?? pdfNome;
      pdfMime = prova.cadernoMimeType ?? pdfMime;
    } else {
      return NextResponse.json(
        { error: "Envie o PDF da prova ou use o caderno já salvo." },
        { status: 400 }
      );
    }
  } else {
    const body = z
      .object({
        aplicar: z.boolean().default(true),
        substituir: z.boolean().default(true),
        incluirGabarito: z.boolean().default(false),
        incluirBlocoEspanhol: z.boolean().default(false),
        excluirBlocoEspanhol: z.boolean().default(false),
        usarCadernoSalvo: z.boolean().optional(),
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
    } else if (body.usarCadernoSalvo && prova.cadernoStoragePath) {
      if (!(await storedFileExists(prova.cadernoStoragePath))) {
        return NextResponse.json(
          { error: "Caderno salvo não encontrado no servidor." },
          { status: 404 }
        );
      }
      const lido = await readStoredFile(prova.cadernoStoragePath);
      pdfBuffer = lido.buffer;
      pdfNome = prova.cadernoFileName ?? pdfNome;
      pdfMime = prova.cadernoMimeType ?? pdfMime;
    }
    if (!pdfBuffer) {
      return NextResponse.json({ error: "Envie o PDF." }, { status: 400 });
    }
  }

  if (!pdfBuffer.length) {
    return NextResponse.json({ error: "Arquivo PDF vazio." }, { status: 400 });
  }

  try {
    const resultado = await executarExtracaoProvaV2(
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
            "Nenhuma questão extraída. Confira o PDF (texto selecionável), o total de questões no cadastro e se o arquivo corresponde à prova.",
          avisos: resultado.avisos,
          etapas: resultado.etapas,
        },
        { status: 422 }
      );
    }

    let gravadas = 0;
    let relatorio: ReturnType<typeof montarRelatorioExtracao> | null = null;
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

      gravadas = await persistirQuestoesExtracaoProva(provaId, rowsComHints, {
        substituir,
      });

      await persistirTextoFonteProva(provaId, montarTextoFonteDeRows(rowsComHints));

      const caderno = await saveProvaCadernoBuffer(provaId, pdfBuffer, pdfNome, pdfMime);
      await prisma.prova.update({
        where: { id: provaId },
        data: {
          cadernoStoragePath: caderno.storagePath,
          cadernoFileName: caderno.fileName,
          cadernoMimeType: caderno.mimeType,
        },
      });

      if (resultado.politicaIdiomas === "DUPLICATA_EN_ES" && resultado.faixaIdioma) {
        await prisma.prova.update({
          where: { id: provaId },
          data: {
            politicaIdiomas: "DUPLICATA_EN_ES",
            idiomaQuestaoInicio: resultado.faixaIdioma.inicio,
            idiomaQuestaoFim: resultado.faixaIdioma.fim,
            ordemIdiomasFaixa: resultado.ordemIdiomasFaixa ?? "INGLES_PRIMEIRO",
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

      const provaAtual = await prisma.prova.findUnique({
        where: { id: provaId },
        include: { questoes: true },
      });
      relatorio = provaAtual
        ? montarRelatorioExtracao(provaAtual.questoes, provaAtual.totalQuestoes, {
            politicaIdiomas: provaAtual.politicaIdiomas,
            idiomaQuestaoInicio: provaAtual.idiomaQuestaoInicio,
            idiomaQuestaoFim: provaAtual.idiomaQuestaoFim,
            ordemIdiomasFaixa: provaAtual.ordemIdiomasFaixa,
            dia: provaAtual.dia,
            banca: provaAtual.banca,
          })
        : null;
    }

    const relatorioResposta =
      aplicar && relatorio
        ? { resumoExtracao: resumoExtracao(relatorio), relatorio }
        : {};

    return NextResponse.json({
      aplicado: aplicar,
      gravadas,
      totalExtraidas: resultado.rows.length,
      totalEsperado: prova.totalQuestoes,
      modeloUsado: resultado.modeloUsado,
      avisos: resultado.avisos,
      etapas: resultado.etapas,
      rows: aplicar ? undefined : resultado.rows,
      csv: resultado.csv || undefined,
      ...relatorioResposta,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro no pipeline";
    console.error(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
