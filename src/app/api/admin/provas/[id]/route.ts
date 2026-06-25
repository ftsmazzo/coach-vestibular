import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { buildProvaNome } from "@/lib/prova-nome";
import { statsQuestoesProva } from "@/lib/prova-stats";
import { prisma } from "@/lib/prisma";
import { compararQuestoesPorNumeroEOrdem } from "@/lib/prova-idioma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;
  const prova = await prisma.prova.findUnique({
    where: { id },
    include: {
      questoes: { orderBy: { numero: "asc" } },
      _count: { select: { tentativas: true } },
      tentativas: {
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { data: "desc" },
      },
    },
  });
  if (!prova) return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });
  const questoesOrdenadas = [...prova.questoes].sort((a, b) =>
    compararQuestoesPorNumeroEOrdem(a, b, prova.ordemIdiomasFaixa)
  );
  const stats = statsQuestoesProva(questoesOrdenadas, prova.totalQuestoes, {
    dia: prova.dia,
    banca: prova.banca,
    politicaIdiomas: prova.politicaIdiomas,
    idiomaQuestaoInicio: prova.idiomaQuestaoInicio,
    idiomaQuestaoFim: prova.idiomaQuestaoFim,
  });
  const { textoFonte, questoes: _q, ...provaSemTexto } = prova;
  return NextResponse.json({
    ...provaSemTexto,
    questoes: questoesOrdenadas,
    textoFonte: textoFonte ?? null,
    temTextoFonte: Boolean(textoFonte?.trim()),
    tamanhoTextoFonte: textoFonte?.length ?? 0,
    questoesCadastradas: stats.cadastradas,
    maiorNumeroQuestao: stats.maiorNumero,
    questoesFaltando: stats.faltando,
    bancoIncompleto: stats.incompleto,
  });
}

const patchSchema = z.object({
  nome: z.string().optional(),
  banca: z.string().optional(),
  tipo: z.enum(["ENEM_OFICIAL", "SIMULADO", "VESTIBULAR", "OUTRO"]).optional(),
  ano: z.number().int().optional().nullable(),
  dia: z.number().int().optional().nullable(),
  caderno: z.string().optional().nullable(),
  descricao: z.string().optional().nullable(),
  totalQuestoes: z.number().int().positive().optional(),
  publicada: z.boolean().optional(),
  ordemIdiomasFaixa: z.enum(["INGLES_PRIMEIRO", "ESPANHOL_PRIMEIRO"]).optional(),
  politicaIdiomas: z.enum(["NENHUMA", "DUPLICATA_EN_ES"]).optional(),
  idiomaQuestaoInicio: z.number().int().positive().optional().nullable(),
  idiomaQuestaoFim: z.number().int().positive().optional().nullable(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = patchSchema.parse(await request.json());
  const atual = await prisma.prova.findUnique({ where: { id } });
  if (!atual) return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });

  const publicandoAgora = body.publicada === true && !atual.publicada;

  const merged = {
    banca: body.banca ?? atual.banca,
    ano: body.ano !== undefined ? body.ano : atual.ano,
    dia: body.dia !== undefined ? body.dia : atual.dia,
    caderno: body.caderno !== undefined ? body.caderno : atual.caderno,
  };
  const nome =
    body.nome?.trim() ||
    buildProvaNome({
      banca: merged.banca,
      ano: merged.ano,
      dia: merged.dia,
      caderno: merged.caderno,
    });

  const prova = await prisma.prova.update({
    where: { id },
    data: { ...body, nome },
  });

  if (publicandoAgora) {
    await notificarNovaProva(prova.nome);
  }

  return NextResponse.json(prova);
}

/** Avisa os alunos com WhatsApp cadastrado que uma nova atividade entrou no catálogo. */
async function notificarNovaProva(nomeProva: string) {
  const { enviarNotificacao, telefoneParaWhatsapp } = await import("@/lib/notificacoes");
  const alunos = await prisma.user.findMany({
    where: { role: "STUDENT", telefone: { not: null } },
    select: { name: true, telefone: true },
  });

  await Promise.allSettled(
    alunos.map((a) => {
      const numero = telefoneParaWhatsapp(a.telefone);
      if (!numero) return Promise.resolve();
      const primeiroNome = a.name.split(/\s+/)[0] || "você";
      const mensagem =
        `Oi, ${primeiroNome}! 📝 Entrou uma atividade nova no Coach: *${nomeProva}*.\n\n` +
        `Que tal fazer e registrar o resultado? O copiloto ajusta seu plano com isso. 💪`;
      return enviarNotificacao({
        evento: "nova_prova",
        numero,
        mensagem,
        meta: { prova: nomeProva },
      });
    })
  );
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;
  await prisma.prova.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
