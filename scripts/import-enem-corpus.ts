/**
 * @deprecated Prefira `scripts/sync-enem-corpus.ts` (sync unificado 1:1 com enem.dev).
 * Mantido como alias para compatibilidade com deploys antigos.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { corpusPrecisaSync, sincronizarCorpusEnem } from "../src/lib/enem-corpus-sync";

function parseArgs() {
  const dryRun = process.argv.includes("--dry-run");
  const ifEmpty = process.argv.includes("--if-empty");
  const anoArg = process.argv.find((a) => a.startsWith("--ano="));
  const ano = anoArg ? Number(anoArg.split("=")[1]) : null;
  return { dryRun, ifEmpty, ano };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("postgresql")) {
    throw new Error("Defina DATABASE_URL (PostgreSQL).");
  }

  const { dryRun, ifEmpty, ano: anoFiltro } = parseArgs();
  const pool = new Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    if (ifEmpty && !anoFiltro && process.env.RUN_ENEM_IMPORT !== "true") {
      const precisa = await corpusPrecisaSync(prisma);
      if (!precisa) {
        console.log("Corpus ENEM completo — use sync-enem-corpus.ts para forçar.");
        return;
      }
      console.log("Corpus incompleto — sync unificado…");
    }

    const r = await sincronizarCorpusEnem(prisma, {
      dryRun,
      anos: anoFiltro ? [anoFiltro] : undefined,
      onProgress: (msg) => console.log(msg),
    });

    console.log(
      `\nResumo: ${r.processadas} processadas` +
        (dryRun ? "" : ` — ${r.criadas} criadas, ${r.atualizadas} atualizadas`) +
        ` · validação ${r.validacao.completo ? "OK" : "incompleta"}`
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
