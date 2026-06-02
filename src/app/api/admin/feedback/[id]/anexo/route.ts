import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { readStoredFile } from "@/lib/upload-storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;
  const feedback = await prisma.feedback.findUnique({
    where: { id },
    select: { anexoPath: true, anexoFileName: true, anexoMimeType: true },
  });

  if (!feedback?.anexoPath) {
    return NextResponse.json({ error: "Sem anexo" }, { status: 404 });
  }

  try {
    const { buffer } = await readStoredFile(feedback.anexoPath);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": feedback.anexoMimeType ?? "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(feedback.anexoFileName ?? "anexo")}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (e) {
    console.error("[admin/feedback/anexo]", e);
    return NextResponse.json({ error: "Anexo não encontrado" }, { status: 404 });
  }
}
