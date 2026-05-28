import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { isSolicitacaoStatus, parseSolicitacaoMeta } from "@/lib/solicitacao-simulado";
import { readStoredFile } from "@/lib/upload-storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;
  const job = await prisma.uploadJob.findUnique({ where: { id } });

  if (!job || !isSolicitacaoStatus(job.status)) {
    return NextResponse.json({ error: "Solicitação não encontrada" }, { status: 404 });
  }
  if (!job.storagePath) {
    return NextResponse.json(
      {
        error:
          "Arquivo não disponível (solicitação antiga ou falha no envio). Peça ao aluno para reenviar.",
      },
      { status: 404 }
    );
  }

  try {
    const { buffer } = await readStoredFile(job.storagePath);
    const meta = parseSolicitacaoMeta(job.resultJson);
    const mimeType = meta.mimeType ?? "application/octet-stream";
    const fileName = job.fileName || "solicitacao";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (e) {
    console.error("[admin/solicitacoes/arquivo]", e);
    return NextResponse.json({ error: "Arquivo não encontrado no servidor" }, { status: 404 });
  }
}
