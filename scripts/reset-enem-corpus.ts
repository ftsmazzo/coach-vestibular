/**
 * Zera todo EnemQuestaoCorpus (estrutura + N2) e reimporta da API enem.dev.
 * Uso:
 *   DATABASE_URL=... npx tsx scripts/reset-enem-corpus.ts
 *   DATABASE_URL=... npx tsx scripts/reset-enem-corpus.ts --dry-run   # só conta, não apaga
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { zerarCorpusEnem } from "../src/lib/enem-corpus-reset";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("postgresql")) {
    throw new Error("Defina DATABASE_URL (PostgreSQL).");
  }

  const pool = new Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const total = await prisma.enemQuestaoCorpus.count();
    console.log(`Corpus atual: ${total} questões.`);

    if (dryRun) {
      console.log("[dry-run] Nada foi apagado.");
      return;
    }

    if (total === 0) {
      console.log("Corpus já vazio.");
      return;
    }

    const r = await zerarCorpusEnem(prisma);
    console.log(`Removidas ${r.removidas} questões. Rode: npm run enem:sync`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
