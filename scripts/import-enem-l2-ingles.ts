/**
 * Importa variantes inglês Q1–5 (enem.dev ?language=ingles).
 * Uso:
 *   npx tsx scripts/import-enem-l2-ingles.ts
 *   npx tsx scripts/import-enem-l2-ingles.ts --if-missing
 *   npx tsx scripts/import-enem-l2-ingles.ts --dry-run
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { importarL2InglesCorpus } from "../src/lib/enem-import-l2-ingles";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const ifMissing = process.argv.includes("--if-missing");
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("postgresql")) {
    throw new Error("DATABASE_URL PostgreSQL obrigatória.");
  }

  const pool = new Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const r = await importarL2InglesCorpus(prisma, { dryRun, pularSeJaTem: ifMissing });
    const prefix = dryRun ? "[dry-run] " : ifMissing ? "[if-missing] " : "";
    console.log(
      `${prefix}L2 inglês: ${r.processadas} processadas · ${r.criadas} criadas · ${r.atualizadas} atualizadas · ${r.anos.length} anos`
    );
    if (r.avisos.length) console.log(r.avisos.join("\n"));
    if (!dryRun && r.criadas > 0) {
      console.log("Rode Classificar Linguagens com IA no admin.");
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
