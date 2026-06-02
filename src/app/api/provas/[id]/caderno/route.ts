import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readStoredFile } from "@/lib/upload-storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const prova = await prisma.prova.findUnique({
    where: { id },
    select: {
      publicada: true,
      cadernoStoragePath: true,
      cadernoFileName: true,
      cadernoMimeType: true,
    },
  });

  if (!prova || (!prova.publicada && session.role !== "ADMIN")) {
    return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });
  }
  if (!prova.cadernoStoragePath) {
    return NextResponse.json({ error: "Esta prova não tem caderno para download." }, { status: 404 });
  }

  try {
    const { buffer } = await readStoredFile(prova.cadernoStoragePath);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": prova.cadernoMimeType ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(prova.cadernoFileName ?? "caderno")}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (e) {
    console.error("[provas/caderno]", e);
    return NextResponse.json({ error: "Caderno não encontrado no servidor" }, { status: 404 });
  }
}
