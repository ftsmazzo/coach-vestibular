/**
 * Manutenção automática de Linguagens no deploy (EasyPanel).
 * 1. Repara idioma/rota e limpa N2 fora da trilha
 * 2. Reclassifica com IA só questões sem N2 válido (se OPENAI_API_KEY)
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { classificarCorpusEnem } from "../src/lib/enem-corpus-classificar";
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

    if (!process.env.OPENAI_API_KEY?.trim()) {
      console.log("  OPENAI_API_KEY ausente — reclassificação IA ignorada.");
      return;
    }

    if (repair.corrigidas === 0 && repair.n2Limpos === 0) {
      const semN2 = await prisma.enemQuestaoCorpus.count({
        where: { disciplina: "linguagens", conhecimentoEscopoId: null },
      });
      if (semN2 === 0) {
        console.log("  Linguagens com N2 ok — classificação IA ignorada.");
        return;
      }
      console.log(`  ${semN2} questões sem N2 — classificando…`);
    } else {
      console.log("  reparo alterou corpus — reclassificando pendências…");
    }

    const resultado = await classificarCorpusEnem(prisma, {
      materiaId: "linguagens",
      modo: "ia",
      limit: 900,
      persistir: true,
    });
    console.log("  classificação:", JSON.stringify(resultado));
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("deploy-enem-linguagens ERRO:", e);
  process.exit(1);
});
