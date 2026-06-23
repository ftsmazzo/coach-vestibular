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
import { inferirIdiomaCorpusLinguagens } from "../src/lib/enem-classificar/linguagens-rota";
import { montarFonteId } from "../src/lib/enem-dev/estrutural";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("postgresql")) {
    throw new Error("DATABASE_URL PostgreSQL obrigatória.");
  }

  const pool = new Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const rows = await prisma.enemQuestaoCorpus.findMany({
      where: { disciplina: "linguagens", numero: { lte: 5 } },
      select: {
        id: true,
        ano: true,
        numero: true,
        idioma: true,
        fonteId: true,
        enunciadoMd: true,
        introducaoAlternativas: true,
        conhecimentoEscopoId: true,
      },
    });

    let corrigidas = 0;
    let n2Limpos = 0;

    for (const r of rows) {
      const texto = [r.enunciadoMd, r.introducaoAlternativas].filter(Boolean).join("\n");
      const idiomaDb = r.idioma === "ingles" || r.idioma === "espanhol" ? r.idioma : "COMUM";
      const idiomaNovo = inferirIdiomaCorpusLinguagens(
        r.numero,
        idiomaDb === "COMUM" ? null : idiomaDb,
        texto
      );
      const fonteIdNovo = montarFonteId(r.ano, r.numero, idiomaNovo);

      if (idiomaNovo === r.idioma && fonteIdNovo === r.fonteId) continue;

      const conflito = await prisma.enemQuestaoCorpus.findUnique({
        where: { fonteId: fonteIdNovo },
        select: { id: true },
      });
      if (conflito && conflito.id !== r.id) {
        console.warn(`  SKIP ${r.fonteId} → ${fonteIdNovo} (fonteId já existe)`);
        continue;
      }

      const limparN2 =
        r.conhecimentoEscopoId &&
        ((idiomaNovo === "ingles" && !r.conhecimentoEscopoId.includes("l2_en")) ||
          (idiomaNovo === "espanhol" && !r.conhecimentoEscopoId.includes("l2_es")) ||
          (idiomaNovo === "COMUM" &&
            (r.conhecimentoEscopoId.includes("l2_en") || r.conhecimentoEscopoId.includes("l2_es"))));

      console.log(
        `  ${r.fonteId} → ${fonteIdNovo} (idioma ${r.idioma} → ${idiomaNovo})` +
          (limparN2 ? " · limpa N2" : "")
      );

      if (!dryRun) {
        await prisma.enemQuestaoCorpus.update({
          where: { id: r.id },
          data: {
            idioma: idiomaNovo,
            fonteId: fonteIdNovo,
            ...(limparN2
              ? {
                  conhecimentoEscopoId: null,
                  conhecimentoDominioId: null,
                  assunto: null,
                  classificacaoConfianca: null,
                  classificacaoVersao: null,
                }
              : {}),
          },
        });
      }

      corrigidas++;
      if (limparN2) n2Limpos++;
    }

    console.log(
      `\n${dryRun ? "[dry-run] " : ""}Corrigidas: ${corrigidas} · N2 limpos para reclassificar: ${n2Limpos}`
    );
    if (!dryRun && corrigidas > 0) {
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
