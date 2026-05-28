import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { extrairQuestoesComIA, type QuestaoExtraida } from "@/lib/ai-extract-prova";
import { extractTextFromPdf } from "@/lib/pdf-text";
import { prisma } from "@/lib/prisma";
import { refreshProvaGabaritoFlag } from "@/lib/prova-attempt";
import type { EtapaExtracao } from "@/lib/prova-extracao-pipeline";
import { mesclarTextoParaBlocos } from "@/lib/prova-blocos-caderno";
import {
  atualizarQuestoesPorEtapa,
  substituirQuestoesExtraidas,
  upsertQuestoesExtraidas,
} from "@/lib/prova-questoes-persist";
import {
  estimarQuestoesNoTexto,
  minCaracteresTextoParcial,
  minCaracteresTextoProva,
  textoParcialPareceIncompleto,
  textoProvaPareceIncompleto,
} from "@/lib/prova-texto-minimo";

/** Extração de prova inteira pode levar vários minutos (OpenAI em lotes). */
export const maxDuration = 600;

const ETAPAS: EtapaExtracao[] = [
  "enunciados",
  "materia",
  "assunto",
  "conhecimento",
  "completo",
];

const bodySchema = z.object({
  texto: z.string().optional(),
  aplicar: z.boolean().default(false),
  modo: z.enum(["substituir", "adicionar"]).default("substituir"),
  etapa: z.enum(["enunciados", "materia", "assunto", "conhecimento", "completo"]).default("completo"),
  continuarDeBanco: z.boolean().default(false),
  excluirBlocoEspanhol: z.boolean().optional(),
  usarTextoFonte: z.boolean().optional(),
});

function parseEtapa(raw: FormDataEntryValue | string | null): EtapaExtracao {
  const s = String(raw ?? "completo");
  return ETAPAS.includes(s as EtapaExtracao) ? (s as EtapaExtracao) : "completo";
}

async function carregarBaseDoBanco(provaId: string): Promise<QuestaoExtraida[]> {
  const rows = await prisma.provaQuestao.findMany({
    where: { provaId },
    orderBy: { numero: "asc" },
  });
  return rows.map((r) => ({
    numero: r.numero,
    trechoEnunciado: r.enunciado?.trim() || "",
    materia: r.materia,
    assunto: r.assunto,
    areaBloco: r.areaBloco,
    conhecimentoExigido: r.conhecimentoExigido,
    nivelDificuldade: r.nivelDificuldade,
    observacoes: r.observacoes,
  }));
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

  let texto = "";
  let aplicar = false;
  let modo: "substituir" | "adicionar" = "substituir";
  let etapa: EtapaExtracao = "completo";
  let continuarDeBanco = false;
  let excluirBlocoEspanhol: boolean | undefined;
  let usarTextoFonte = false;
  let fonteTexto: "pdf" | "colado" | "textoFonte" | "nenhum" = "nenhum";

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json(
        {
          error:
            "Não foi possível ler o envio (PDF/texto muito grande ou corpo truncado). Grave o texto na etapa 1 uma vez; nas etapas 2–4 o servidor usa o texto já salvo sem reenviar.",
        },
        { status: 413 }
      );
    }
    aplicar = form.get("aplicar") === "true";
    modo = form.get("modo") === "adicionar" ? "adicionar" : "substituir";
    etapa = parseEtapa(form.get("etapa"));
    continuarDeBanco = form.get("continuarDeBanco") === "true";
    const rawExcluir = form.get("excluirBlocoEspanhol");
    if (rawExcluir != null) {
      excluirBlocoEspanhol = rawExcluir === "true";
    }
    usarTextoFonte = form.get("usarTextoFonte") === "true";
    const textField = form.get("texto") as string | null;
    const file = form.get("file") as File | null;

    // PDF e texto colado têm prioridade sobre texto antigo no banco
    if (file) {
      const buf = Buffer.from(await file.arrayBuffer());
      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        texto = await extractTextFromPdf(buf);
        fonteTexto = "pdf";
        if (texto.length < 200) {
          return NextResponse.json(
            {
              error:
                "PDF com pouco texto extraível (pode ser escaneado). Cole o texto da prova manualmente ou use um PDF com texto selecionável.",
              caracteresExtraidos: texto.length,
            },
            { status: 400 }
          );
        }
      } else if (file.type.startsWith("text/") || file.name.endsWith(".txt")) {
        texto = await buf.toString("utf-8");
        fonteTexto = "pdf";
      } else {
        return NextResponse.json(
          { error: "Formato não suportado. Use PDF ou TXT, ou cole o texto." },
          { status: 400 }
        );
      }
    } else if (textField?.trim()) {
      texto = textField.trim();
      fonteTexto = "colado";
    } else if (usarTextoFonte) {
      const salvo = await prisma.prova.findUnique({
        where: { id: provaId },
        select: { textoFonte: true },
      });
      if (!salvo?.textoFonte?.trim()) {
        return NextResponse.json(
          {
            error:
              "Não há texto da prova salvo no servidor. Cole o texto no campo ou envie o PDF.",
          },
          { status: 400 }
        );
      }
      texto = salvo.textoFonte.trim();
      fonteTexto = "textoFonte";
    }
  } else {
    const body = bodySchema.parse(await request.json());
    texto = body.texto ?? "";
    aplicar = body.aplicar;
    modo = body.modo;
    etapa = body.etapa;
    continuarDeBanco = body.continuarDeBanco;
    excluirBlocoEspanhol = body.excluirBlocoEspanhol;
    usarTextoFonte = body.usarTextoFonte === true;
    if (texto.trim()) {
      fonteTexto = "colado";
    } else if (usarTextoFonte) {
      const salvo = await prisma.prova.findUnique({
        where: { id: provaId },
        select: { textoFonte: true },
      });
      if (!salvo?.textoFonte?.trim()) {
        return NextResponse.json(
          { error: "Não há texto da prova salvo no servidor." },
          { status: 400 }
        );
      }
      texto = salvo.textoFonte.trim();
      fonteTexto = "textoFonte";
    }
  }

  const excluirEs =
    excluirBlocoEspanhol ?? process.env.EXCLUIR_BLOCO_ESPANHOL !== "false";

  const precisaTexto = etapa === "enunciados" || etapa === "completo";
  let baseInicial: QuestaoExtraida[] | undefined;

  if (continuarDeBanco || (!precisaTexto && !texto.trim())) {
    baseInicial = await carregarBaseDoBanco(provaId);
    if (baseInicial.length === 0) {
      return NextResponse.json(
        { error: "Não há questões no banco. Extraia e grave os enunciados primeiro." },
        { status: 400 }
      );
    }
    const semEnunciado = baseInicial.filter((q) => q.trechoEnunciado.length < 20);
    if (semEnunciado.length > 0 && etapa !== "enunciados") {
      return NextResponse.json(
        {
          error: `Questões sem enunciado no banco: nº ${semEnunciado
            .slice(0, 10)
            .map((q) => q.numero)
            .join(", ")}. Rode a etapa 1 antes.`,
        },
        { status: 400 }
      );
    }
  }

  if (precisaTexto && !texto.trim()) {
    return NextResponse.json(
      { error: "Envie PDF, texto ou TXT da prova para extrair enunciados." },
      { status: 400 }
    );
  }

  if (precisaTexto && modo === "adicionar") {
    if (textoParcialPareceIncompleto(texto.length, texto, prova.totalQuestoes)) {
      const minimo = minCaracteresTextoParcial(texto, prova.totalQuestoes);
      const n = estimarQuestoesNoTexto(texto);
      return NextResponse.json(
        {
          error: `Texto curto demais: ${texto.length} caracteres para ~${n} questão(ões) no trecho (mínimo ~${minimo}). Cole o enunciado completo da(s) questão(ões) faltante(s).`,
          caracteresRecebidos: texto.length,
          minimoEsperado: minimo,
          fonte: fonteTexto,
        },
        { status: 400 }
      );
    }
  } else if (precisaTexto && textoProvaPareceIncompleto(texto.length, prova.totalQuestoes)) {
    const minimo = minCaracteresTextoProva(prova.totalQuestoes);
    const dicaFonte =
      fonteTexto === "textoFonte"
        ? " O sistema usou um texto antigo truncado salvo no servidor — clique em «Limpar texto salvo», cole a prova inteira no campo (ou envie o PDF) e tente de novo."
        : fonteTexto === "pdf"
          ? " O PDF enviou pouco texto — cole o conteúdo manualmente no campo «Ou cole o texto»."
          : " Cole a prova completa no campo de texto (todas as questões 1–65), não só um trecho.";
    return NextResponse.json(
      {
        error: `Texto insuficiente: ${texto.length} caracteres recebidos, esperado pelo menos ~${minimo} para ${prova.totalQuestoes} questões.${dicaFonte}`,
        caracteresRecebidos: texto.length,
        minimoEsperado: minimo,
        fonte: fonteTexto,
      },
      { status: 400 }
    );
  }

  try {
    const fonteDb = await prisma.prova.findUnique({
      where: { id: provaId },
      select: { textoFonte: true },
    });
    const partesCaderno = [texto.trim(), fonteDb?.textoFonte?.trim()].filter(Boolean);
    const textoCaderno = partesCaderno.join("\n\n");
    const textoParaPipeline = texto.trim();
    const textoCadernoFinal =
      baseInicial?.length && etapa !== "enunciados"
        ? mesclarTextoParaBlocos(textoCaderno, baseInicial)
        : textoCaderno;

    const totalParaPipeline =
      modo === "adicionar"
        ? Math.max(estimarQuestoesNoTexto(texto), 1)
        : prova.totalQuestoes;

    const resultado = await extrairQuestoesComIA(
      textoParaPipeline || texto,
      {
        nome: prova.nome,
        banca: prova.banca,
        ano: prova.ano,
        caderno: prova.caderno,
        totalEsperado: totalParaPipeline,
      },
      {
        etapa,
        baseInicial,
        textoCaderno: textoCadernoFinal || undefined,
        excluirBlocoEspanhol: excluirEs,
        validarCoberturaCompleta: modo !== "adicionar",
      }
    );

    let adicionadas = 0;
    if (aplicar && resultado.questoes.length > 0) {
      if (etapa === "completo" && modo === "substituir") {
        await substituirQuestoesExtraidas(provaId, resultado.questoes);
        adicionadas = resultado.questoes.length;
      } else if (etapa === "enunciados" && modo === "substituir") {
        await substituirQuestoesExtraidas(provaId, resultado.questoes);
        adicionadas = resultado.questoes.length;
      } else if (etapa === "completo" && modo === "adicionar") {
        adicionadas = await upsertQuestoesExtraidas(provaId, resultado.questoes);
      } else {
        adicionadas = await atualizarQuestoesPorEtapa(provaId, resultado.questoes, etapa);
      }

      await refreshProvaGabaritoFlag(provaId);

      if (texto.trim() && (etapa === "enunciados" || etapa === "completo")) {
        const atualFonte = await prisma.prova.findUnique({
          where: { id: provaId },
          select: { textoFonte: true },
        });
        const textoSalvar =
          modo === "adicionar" && atualFonte?.textoFonte?.trim()
            ? `${atualFonte.textoFonte.trim()}\n\n--- trecho adicional ---\n\n${texto.trim()}`
            : texto.trim();
        await prisma.prova.update({
          where: { id: provaId },
          data: { textoFonte: textoSalvar.slice(0, 500_000) },
        });
      }
    }

    return NextResponse.json({
      ...resultado,
      aplicado: aplicar,
      modo,
      etapa,
      excluirBlocoEspanhol: excluirEs,
      adicionadas: aplicar ? adicionadas : 0,
      caracteresProcessados: texto.length,
      fonteTexto,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro na extração";
    console.error(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
