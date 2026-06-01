import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import {
  isSolicitacaoStatus,
  parseSolicitacaoMeta,
  STATUS_SOLICITACAO_PENDENTE,
  STATUS_SOLICITACAO_PROCESSADA,
} from "@/lib/solicitacao-simulado";
import { storedFileExists } from "@/lib/upload-storage";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const soPendentes = searchParams.get("pendentes") === "1";

  const jobs = await prisma.uploadJob.findMany({
    where: soPendentes
      ? { status: STATUS_SOLICITACAO_PENDENTE }
      : {
          status: {
            in: [STATUS_SOLICITACAO_PENDENTE, STATUS_SOLICITACAO_PROCESSADA],
          },
        },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  const lista = await Promise.all(
    jobs
      .filter((j) => isSolicitacaoStatus(j.status))
      .map(async (j) => {
        const meta = parseSolicitacaoMeta(j.resultJson);
        const temArquivo = j.storagePath
          ? await storedFileExists(j.storagePath)
          : false;
        const temGabaritoArquivo = meta.gabaritoStoragePath
          ? await storedFileExists(meta.gabaritoStoragePath)
          : false;
        return {
          id: j.id,
          fileName: j.fileName,
          status: j.status,
          storagePath: j.storagePath,
          temArquivo,
          createdAt: j.createdAt.toISOString(),
          user: j.user,
          nome: meta.nome ?? j.fileName,
          banca: meta.banca ?? null,
          observacao: meta.observacao ?? null,
          tamanhoBytes: meta.tamanhoBytes,
          mimeType: meta.mimeType,
          gabaritoTexto: meta.gabaritoTexto ?? null,
          gabaritoFileName: meta.gabaritoFileName ?? null,
          temGabaritoArquivo,
        };
      })
  );

  return NextResponse.json(lista);
}
