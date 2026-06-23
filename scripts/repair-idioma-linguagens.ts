/**
 * Corrige idioma/fonteId das questões L2 (Q1–5) em Linguagens.
 * enem.dev envia inglês com language=null → import antigo gravava COMUM.
 *
 * Uso: npx tsx scripts/repair-idioma-linguagens.ts [--dry-run]
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { repararIdiomaLinguagensCorpus } from "../src/lib/enem-repair-linguagens";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("postgresql")) {
    throw new Error("DATABASE_URL PostgreSQL obrigatória.");
  }

  const pool = new Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const r = await repararIdiomaLinguagensCorpus(prisma, { dryRun });
    for (const linha of r.amostra) console.log(`  ${linha}`);
    console.log(
      `\n${dryRun ? "[dry-run] " : ""}Corrigidas: ${r.corrigidas} · N2 limpos: ${r.n2Limpos} · ignoradas: ${r.ignoradas}`
    );
    if (!dryRun && r.corrigidas > 0) {
      console.log("Rode Classificar Linguagens com IA no admin para reprocessar trilhas L2.");
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
