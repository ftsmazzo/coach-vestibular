/**
 * Benchmark de classificação heurística por matéria (Natureza).
 *
 * Uso:
 *   npx tsx scripts/benchmark-enem-materia.ts --materia=quimica
 *   npx tsx scripts/benchmark-enem-materia.ts --materia=biologia --ano=2023
 *   npx tsx scripts/benchmark-enem-materia.ts --materia=quimica --persist
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  agregarBenchmark,
  classificarPorKeywords,
} from "../src/lib/enem-classificar/heuristica";
import {
  carregarCatalogoMateria,
  indexarEscopos,
  labelMateriaCorpus,
  validarCatalogo,
  type MateriaCorpusId,
} from "../src/lib/conhecimento-catalog";
import { CORPUS_MATERIA_CONFIG, whereCorpusMateria } from "../src/lib/enem-corpus-materia";

function parseArgs() {
  const materiaArg = process.argv.find((a) => a.startsWith("--materia="));
  const anoArg = process.argv.find((a) => a.startsWith("--ano="));
  const assuntoArg = process.argv.find((a) => a.startsWith("--assunto="));
  const materia = (materiaArg?.split("=")[1] ?? "quimica") as MateriaCorpusId;
  return {
    materiaId: materia,
    ano: anoArg ? Number(anoArg.split("=")[1]) : null,
    assunto: assuntoArg?.split("=")[1],
    persist: process.argv.includes("--persist"),
  };
}

async function main() {
  const { materiaId, ano, assunto, persist } = parseArgs();
  const catalog = carregarCatalogoMateria(materiaId);
  const validacao = validarCatalogo(catalog);
  const falhas = validacao.filter((v) => !v.ok);

  console.log(`=== Validação catálogo ${catalog.materiaLabel} ===`);
  for (const v of validacao) {
    console.log(`  [${v.nivel}] ${v.ok ? "OK" : "FALHA"} — ${v.mensagem}`);
  }
  if (falhas.length > 0) {
    console.error("\nCatálogo inválido — corrija antes do benchmark.");
    process.exit(1);
  }

  const escopos = indexarEscopos(catalog);
  const confiancaMinima = catalog.regras?.confiancaMinima ?? 0.35;
  const materiaLabel = labelMateriaCorpus(materiaId);

  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("postgresql")) {
    throw new Error("DATABASE_URL PostgreSQL obrigatória.");
  }

  const pool = new Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const questoes = await prisma.enemQuestaoCorpus.findMany({
      where: {
        ...whereCorpusMateria(materiaId),
        ...(ano ? { ano } : {}),
      },
      select: {
        id: true,
        fonteId: true,
        enunciadoMd: true,
        introducaoAlternativas: true,
      },
      orderBy: [{ ano: "desc" }, { numero: "asc" }],
    });

    if (questoes.length === 0) {
      const cfg = CORPUS_MATERIA_CONFIG[materiaId];
      console.log(
        `\nNenhuma questão no corpus para ${materiaLabel} (${cfg.disciplina}${cfg.naturezaSub ? " · triadas" : ""}).`
      );
      return;
    }

    console.log(
      `\n=== Benchmark ${catalog.materiaLabel} (${questoes.length} triadas${ano ? ` · ${ano}` : ""}) ===`
    );
    console.log(`Confiança mínima: ${confiancaMinima}${assunto ? ` · assunto=${assunto}` : ""}`);

    const resultados: Array<{ fonteId: string; resultado: ReturnType<typeof classificarPorKeywords> }> = [];

    for (const q of questoes) {
      const texto = [q.enunciadoMd, q.introducaoAlternativas].filter(Boolean).join("\n");
      const resultado = classificarPorKeywords(texto, escopos, {
        confiancaMinima,
        assuntoId: assunto,
      });
      resultados.push({ fonteId: q.fonteId, resultado });

      if (persist && resultado.escopoId) {
        await prisma.enemQuestaoCorpus.update({
          where: { id: q.id },
          data: {
            assunto: resultado.assuntoId,
            conhecimentoDominioId: resultado.dominioId,
            conhecimentoEscopoId: resultado.escopoId,
            classificacaoConfianca: resultado.confianca,
            classificacaoVersao: "heuristica-benchmark",
          },
        });
      }
    }

    const bench = agregarBenchmark(resultados);
    console.log(`\nClassificadas: ${bench.classified} (${bench.pctClassified}%)`);
    console.log(`Unclassified:  ${bench.unclassified} (${bench.pctUnclassified}%)`);
    console.log(`Review:        ${bench.review}`);
    console.log("\nTop N2:");
    for (const t of bench.topEscopos) {
      console.log(`  ${t.count}x  ${t.escopoId}`);
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
