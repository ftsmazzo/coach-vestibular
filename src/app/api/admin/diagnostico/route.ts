import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { existsSync } from "node:fs";
import { join } from "node:path";

/** Diagnóstico rápido: banco, contagem de provas e storage de uploads (admin). */
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const [provaCount, questaoCount, publicadaCount] = await Promise.all([
    prisma.prova.count(),
    prisma.provaQuestao.count(),
    prisma.prova.count({ where: { publicada: true } }),
  ]);

  const uploadDir =
    process.env.UPLOAD_STORAGE_DIR?.trim() || join(process.cwd(), "data", "uploads");
  const uploadsExiste = existsSync(uploadDir);

  const dbUrl = process.env.DATABASE_URL ?? "";
  const dbTipo = dbUrl.startsWith("postgresql")
    ? "postgresql"
    : dbUrl.startsWith("file:")
      ? "sqlite"
      : "desconhecido";

  let dbHost = "";
  try {
    if (dbUrl.startsWith("postgresql")) {
      dbHost = new URL(dbUrl.replace(/^postgresql:/, "http:")).hostname;
    }
  } catch {
    dbHost = "(não parseável)";
  }

  const ultimaProva = await prisma.prova.findFirst({
    orderBy: { updatedAt: "desc" },
    select: { id: true, nome: true, updatedAt: true, publicada: true },
  });

  return NextResponse.json({
    ok: true,
    banco: {
      tipo: dbTipo,
      host: dbHost || null,
    },
    contagens: {
      provas: provaCount,
      questoes: questaoCount,
      publicadas: publicadaCount,
    },
    ultimaProva: ultimaProva
      ? {
          id: ultimaProva.id,
          nome: ultimaProva.nome,
          publicada: ultimaProva.publicada,
          updatedAt: ultimaProva.updatedAt.toISOString(),
        }
      : null,
    storage: {
      uploadDir,
      uploadsExiste,
      avisoVolume:
        !uploadsExiste
          ? "Pasta de uploads não existe — PDFs de prova podem não persistir entre deploys."
          : null,
    },
    envPerigoso: {
      confirmarReset: process.env.CONFIRMAR_RESET === "true",
      runSeed: process.env.RUN_SEED === "true",
    },
  });
}
