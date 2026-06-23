/**
 * Sincroniza corpus ENEM 1:1 com enem.dev.
 * Uso:
 *   DATABASE_URL=... npx tsx scripts/sync-enem-corpus.ts
 *   DATABASE_URL=... npx tsx scripts/sync-enem-corpus.ts --if-incomplete
 *   DATABASE_URL=... npx tsx scripts/sync-enem-corpus.ts --ano=2023
 *   DATABASE_URL=... npx tsx scripts/sync-enem-corpus.ts --dry-run
 *   DATABASE_URL=... npx tsx scripts/sync-enem-corpus.ts --reset   # zera e importa do zero
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  corpusPrecisaSync,
  resetarESincronizarCorpusEnem,
  sincronizarCorpusEnem,
  type ResetSyncCorpusResultado,
  type SyncCorpusResultado,
} from "../src/lib/enem-corpus-sync";
import { validarCorpusEstruturalBanco } from "../src/lib/enem-corpus-validacao";

function parseArgs() {
  const dryRun = process.argv.includes("--dry-run");
  const ifIncomplete = process.argv.includes("--if-incomplete");
  const reset = process.argv.includes("--reset");
  const anoArg = process.argv.find((a) => a.startsWith("--ano="));
  const ano = anoArg ? Number(anoArg.split("=")[1]) : null;
  return { dryRun, ifIncomplete, reset, ano };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("postgresql")) {
    throw new Error("Defina DATABASE_URL (PostgreSQL).");
  }

  const { dryRun, ifIncomplete, reset, ano } = parseArgs();
  const pool = new Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    if (ifIncomplete && !ano && !reset && process.env.RUN_ENEM_IMPORT !== "true") {
      const precisa = await corpusPrecisaSync(prisma);
      if (!precisa) {
        const v = await validarCorpusEstruturalBanco(prisma);
        console.log(`Corpus ENEM completo (${v.total} questões) — sync ignorado.`);
        console.log(v.itens.map((i) => `  [${i.nivel}] ${i.mensagem}`).join("\n"));
        return;
      }
      console.log("Corpus incompleto — iniciando sync completo…");
    }

    if (reset && dryRun) {
      throw new Error("Use --reset sem --dry-run.");
    }

    if (reset) {
      console.log("Zerando corpus e reimportando da API enem.dev…");
    }

    let resultado: SyncCorpusResultado | ResetSyncCorpusResultado;

    if (reset) {
      resultado = await resetarESincronizarCorpusEnem(prisma, {
        dryRun,
        anos: ano ? [ano] : undefined,
        onProgress: (msg) => console.log(msg),
      });
      console.log(`Reset: ${resultado.reset.removidas} questões removidas.`);
    } else {
      resultado = await sincronizarCorpusEnem(prisma, {
        dryRun,
        anos: ano ? [ano] : undefined,
        onProgress: (msg) => console.log(msg),
      });
    }

    const v = resultado.validacao;
    console.log(
      `\nSync v${resultado.versao}${dryRun ? " (dry-run)" : ""}: ` +
        `${resultado.processadas} processadas · ${resultado.criadas} criadas · ` +
        `${resultado.atualizadas} atualizadas · ${(resultado.duracaoMs / 1000).toFixed(1)}s`
    );
    console.log(
      `Validação: API=${v.totalApi} banco=${v.totalBanco} delta=${v.delta} ` +
        `${v.completo ? "✓ completo" : "✗ incompleto"}`
    );
    for (const item of v.itens) {
      console.log(`  [${item.nivel}] ${item.ok ? "OK" : "!!"} ${item.mensagem}`);
    }
    if (resultado.avisos.length) console.log("Avisos:\n" + resultado.avisos.join("\n"));
    if (v.faltando.length) {
      console.log(`Faltando (amostra): ${v.faltando.slice(0, 10).join(", ")}`);
    }
    if (!v.completo && !dryRun) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
