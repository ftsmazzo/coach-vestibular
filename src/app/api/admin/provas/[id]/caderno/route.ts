import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { saveProvaCaderno } from "@/lib/upload-storage";

const MAX_MB = 25;
const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;
  const prova = await prisma.prova.findUnique({ where: { id }, select: { id: true } });
  if (!prova) return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return NextResponse.json({ error: "Anexe o PDF ou imagem do caderno." }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "Use PDF ou imagem." }, { status: 400 });
  }
  if (file.size > MAX_MB * 1024 * 1024) {
    return NextResponse.json({ error: `Arquivo muito grande (máx. ${MAX_MB} MB).` }, { status: 400 });
  }

  let storagePath: string;
  try {
    storagePath = await saveProvaCaderno(id, file);
  } catch (e) {
    console.error("[admin/provas/caderno] falha ao salvar:", e);
    return NextResponse.json({ error: "Não foi possível salvar o caderno." }, { status: 500 });
  }

  await prisma.prova.update({
    where: { id },
    data: {
      cadernoStoragePath: storagePath,
      cadernoFileName: file.name,
      cadernoMimeType: file.type,
    },
  });

  return NextResponse.json({ ok: true, fileName: file.name, mensagem: "Caderno salvo. Os alunos já podem baixar." });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;
  await prisma.prova.update({
    where: { id },
    data: { cadernoStoragePath: null, cadernoFileName: null, cadernoMimeType: null },
  });
  return NextResponse.json({ ok: true, mensagem: "Caderno removido do download." });
}
