import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  texto: z.string().min(1),
});

/** Grava o texto completo da prova (cola) sem passar pela extração. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id: provaId } = await params;
  const prova = await prisma.prova.findUnique({ where: { id: provaId } });
  if (!prova) return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });

  const { texto } = bodySchema.parse(await request.json());
  const t = texto.trim();
  if (t.length < 100) {
    return NextResponse.json({ error: "Texto muito curto." }, { status: 400 });
  }

  await prisma.prova.update({
    where: { id: provaId },
    data: { textoFonte: t.slice(0, 500_000) },
  });

  return NextResponse.json({
    ok: true,
    caracteres: t.length,
    mensagem: `Texto da prova salvo (${t.length.toLocaleString("pt-BR")} caracteres).`,
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id: provaId } = await params;
  await prisma.prova.update({
    where: { id: provaId },
    data: { textoFonte: null },
  });

  return NextResponse.json({ ok: true, mensagem: "Texto salvo no servidor removido." });
}
