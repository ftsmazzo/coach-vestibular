/**
 * No deploy: reverte idioma corrompido (Q6+ → COMUM) e limpa N2 fora da rota.
 * Não dispara classificação IA em massa — use o admin quando quiser.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  LINGUAGENS_ROTA_VERSION,
  repararIdiomaLinguagensCorpus,
} from "../src/lib/enem-repair-linguagens";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("postgresql")) {
    console.log("deploy-enem-linguagens: DATABASE_URL ausente — ignorado.");
    return;
  }

  const pool = new Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const total = await prisma.enemQuestaoCorpus.count({
      where: { disciplina: "linguagens" },
    });
    if (total === 0) {
      console.log("deploy-enem-linguagens: corpus Linguagens vazio — aguardar sync ENEM.");
      return;
    }

    console.log(`deploy-enem-linguagens: rota v${LINGUAGENS_ROTA_VERSION} · ${total} questões`);
    const repair = await repararIdiomaLinguagensCorpus(prisma);
    console.log(
      `  reparo: corrigidas=${repair.corrigidas} n2Limpos=${repair.n2Limpos} ignoradas=${repair.ignoradas}`
    );
    for (const linha of repair.amostra) console.log(`    ${linha}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("deploy-enem-linguagens ERRO:", e);
  process.exit(1);
});
