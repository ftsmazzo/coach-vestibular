/**
 * Valida catálogo + benchmark de classificação heurística (piloto Biologia/Ecologia).
 *
 * Uso:
 *   npx tsx scripts/benchmark-enem-biologia.ts
 *   npx tsx scripts/benchmark-enem-biologia.ts --ano=2023
 *   npx tsx scripts/benchmark-enem-biologia.ts --assunto=ecologia --persist
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
  validarCatalogo,
} from "../src/lib/conhecimento-catalog";

function parseArgs() {
  const anoArg = process.argv.find((a) => a.startsWith("--ano="));
  const assuntoArg = process.argv.find((a) => a.startsWith("--assunto="));
  return {
    ano: anoArg ? Number(anoArg.split("=")[1]) : null,
    assunto: assuntoArg?.split("=")[1] ?? "ecologia",
    persist: process.argv.includes("--persist"),
  };
}

async function main() {
  const catalog = carregarCatalogoMateria("biologia");
  const validacao = validarCatalogo(catalog);
  const falhas = validacao.filter((v) => !v.ok);

  console.log("=== Validação catálogo Biologia ===");
  for (const v of validacao) {
    console.log(`  [${v.nivel}] ${v.ok ? "OK" : "FALHA"} — ${v.mensagem}`);
  }
  if (falhas.length > 0) {
    console.error("\nCatálogo inválido — corrija antes do benchmark.");
    process.exit(1);
  }

  const escopos = indexarEscopos(catalog);
  const confiancaMinima = catalog.regras?.confiancaMinima ?? 0.35;
  const { ano, assunto, persist } = parseArgs();

  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("postgresql")) {
    throw new Error("DATABASE_URL PostgreSQL obrigatória.");
  }

  const pool = new Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const questoes = await prisma.enemQuestaoCorpus.findMany({
      where: {
        disciplina: "ciencias_natureza",
        ...(ano ? { ano } : {}),
      },
      select: {
        id: true,
        fonteId: true,
        ano: true,
        numero: true,
        enunciadoMd: true,
        introducaoAlternativas: true,
      },
      orderBy: [{ ano: "desc" }, { numero: "asc" }],
      take: ano ? undefined : 500,
    });

    if (questoes.length === 0) {
      console.log("\nCorpus ENEM vazio — aguarde import em background ou rode npm run enem:import");
      return;
    }

    console.log(`\n=== Benchmark classificação (${questoes.length} questões Natureza${ano ? ` ${ano}` : ""}) ===`);
    console.log(`Piloto assunto: ${assunto} | confiança mínima: ${confiancaMinima}`);

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
            materia: "Biologia",
            assunto: resultado.assuntoId,
            conhecimentoDominioId: resultado.dominioId,
            conhecimentoEscopoId: resultado.escopoId,
            classificacaoConfianca: resultado.confianca,
            classificacaoVersao: "heuristica-v0.1",
          },
        });
      }
    }

    const bench = agregarBenchmark(resultados);

    console.log(`\nClassificadas:     ${bench.classified} (${bench.pctClassified}%)`);
    console.log(`Unclassified:      ${bench.unclassified} (${bench.pctUnclassified}%)`);
    console.log(`Fila revisão:      ${bench.review}`);
    console.log(`\nTop N2 (${assunto}):`);
    for (const t of bench.topEscopos) {
      console.log(`  ${t.count}x  ${t.escopoId}`);
    }

    if (bench.filaRevisao.length > 0) {
      console.log("\nAmostra fila (unclassified/review):");
      for (const f of bench.filaRevisao.slice(0, 8)) {
        console.log(`  ${f.fonteId} — ${f.motivo}`);
      }
    }

    console.log(
      "\nNota: % classificável honesto = classified / total. Fila unclassified indica buracos no catálogo."
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
