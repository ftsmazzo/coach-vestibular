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
  const tipo = new URL(_request.url).searchParams.get("tipo");
  const job = await prisma.uploadJob.findUnique({ where: { id } });

  if (!job || !isSolicitacaoStatus(job.status)) {
    return NextResponse.json({ error: "Solicitação não encontrada" }, { status: 404 });
  }

  const meta = parseSolicitacaoMeta(job.resultJson);

  const alvo =
    tipo === "gabarito"
      ? {
          path: meta.gabaritoStoragePath ?? null,
          mimeType: meta.gabaritoMimeType ?? "application/octet-stream",
          fileName: meta.gabaritoFileName ?? "gabarito",
        }
      : {
          path: job.storagePath,
          mimeType: meta.mimeType ?? "application/octet-stream",
          fileName: job.fileName || "solicitacao",
        };

  if (!alvo.path) {
    return NextResponse.json(
      {
        error:
          tipo === "gabarito"
            ? "Gabarito não enviado nesta solicitação."
            : "Arquivo não disponível (solicitação antiga ou falha no envio). Peça ao aluno para reenviar.",
      },
      { status: 404 }
    );
  }

  try {
    const { buffer } = await readStoredFile(alvo.path);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": alvo.mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(alvo.fileName)}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (e) {
    console.error("[admin/solicitacoes/arquivo]", e);
    return NextResponse.json({ error: "Arquivo não encontrado no servidor" }, { status: 404 });
  }
}
