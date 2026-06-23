/**
 * Importa corpus estrutural ENEM (enem.dev) para EnemQuestaoCorpus.
 * Uso:
 *   DATABASE_URL=... npx tsx scripts/import-enem-corpus.ts
 *   DATABASE_URL=... npx tsx scripts/import-enem-corpus.ts --ano=2023
 *   DATABASE_URL=... npx tsx scripts/import-enem-corpus.ts --dry-run
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { iterarQuestoesAno, listarProvasEnem } from "../src/lib/enem-dev/client";
import { mapearQuestaoEstrutural } from "../src/lib/enem-dev/estrutural";
import { importarL2InglesCorpus } from "../src/lib/enem-import-l2-ingles";

function parseArgs() {
  const dryRun = process.argv.includes("--dry-run");
  const ifEmpty = process.argv.includes("--if-empty");
  const anoArg = process.argv.find((a) => a.startsWith("--ano="));
  const ano = anoArg ? Number(anoArg.split("=")[1]) : null;
  return { dryRun, ifEmpty, ano };
}

/** Corpus completo enem.dev 2009–2023 ≈ 2.700 questões (183/ano nos anos recentes). */
const CORPUS_MINIMO = Number(process.env.ENEM_CORPUS_MIN ?? "2500");

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
      const totalExistente = await prisma.enemQuestaoCorpus.count();
      if (totalExistente >= CORPUS_MINIMO) {
        console.log(
          `Corpus ENEM já populado (${totalExistente} questões) — import ignorado. Use RUN_ENEM_IMPORT=true para forçar.`
        );
        return;
      }
      if (totalExistente > 0) {
        console.log(
          `Corpus ENEM incompleto (${totalExistente}/${CORPUS_MINIMO}) — retomando importação...`
        );
      }
    }
    const provas = await listarProvasEnem();
    const anos = anoFiltro
      ? provas.filter((p) => p.year === anoFiltro).map((p) => p.year)
      : provas.map((p) => p.year);

    if (anos.length === 0) {
      throw new Error(anoFiltro ? `Ano ${anoFiltro} não encontrado na API.` : "Nenhum ano.");
    }

    console.log(`Importação estrutural enem.dev — anos: ${anos.join(", ")}${dryRun ? " (dry-run)" : ""}`);

    let total = 0;
    let criadas = 0;
    let atualizadas = 0;

    for (const ano of anos.sort((a, b) => a - b)) {
      console.log(`\n→ ENEM ${ano}...`);
      for await (const q of iterarQuestoesAno(ano)) {
        const row = mapearQuestaoEstrutural(q);
        total++;

        if (dryRun) {
          if (total <= 3) console.log(`  [dry] ${row.fonteId} — ${row.disciplina}`);
          continue;
        }

        const existente = await prisma.enemQuestaoCorpus.findUnique({
          where: { fonteId: row.fonteId },
          select: { id: true },
        });

        const data = {
          ano: row.ano,
          numero: row.numero,
          idioma: row.idioma,
          dia: row.dia,
          disciplina: row.disciplina,
          titulo: row.titulo,
          enunciadoMd: row.enunciadoMd,
          introducaoAlternativas: row.introducaoAlternativas,
          alternativas: row.alternativas as Prisma.InputJsonValue,
          gabarito: row.gabarito,
          arquivos:
            row.arquivos === null ? Prisma.JsonNull : (row.arquivos as Prisma.InputJsonValue),
          areaBloco: row.areaBloco,
          fonte: "enem.dev",
          fonteId: row.fonteId,
        };

        if (existente) {
          await prisma.enemQuestaoCorpus.update({
            where: { id: existente.id },
            data,
          });
          atualizadas++;
        } else {
          await prisma.enemQuestaoCorpus.create({ data });
          criadas++;
        }
      }
      console.log(`  ENEM ${ano} concluído.`);
    }

    if (!dryRun) {
      console.log("\n→ Importando variantes inglês Q1–5 (enem.dev ?language=ingles)...");
      const l2 = await importarL2InglesCorpus(prisma, { anos });
      console.log(
        `  L2 inglês: ${l2.processadas} processadas — ${l2.criadas} criadas, ${l2.atualizadas} atualizadas (${l2.anos.length} anos)`
      );
    }

    console.log(
      `\nResumo: ${total} questões processadas` +
        (dryRun ? "" : ` — ${criadas} criadas, ${atualizadas} atualizadas`)
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
