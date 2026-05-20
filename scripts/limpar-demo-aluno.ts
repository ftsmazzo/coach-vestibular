/**
 * Remove registros de exemplo da conta demo (ou de um e-mail informado).
 * Uso: DATABASE_URL=... npx tsx scripts/limpar-demo-aluno.ts
 * Opcional: EMAIL=aluna@coach.local npx tsx scripts/limpar-demo-aluno.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";

const NOME_SIMULADO_EXEMPLO = "Simulado Cursinho - Exemplo validação";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("postgresql")) {
    throw new Error("Defina DATABASE_URL (PostgreSQL).");
  }

  const email = process.env.EMAIL ?? "aluna@coach.local";
  const pool = new Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log(`Usuário não encontrado: ${email}`);
      return;
    }

    const examsExemplo = await prisma.exam.findMany({
      where: {
        userId: user.id,
        OR: [
          { nome: NOME_SIMULADO_EXEMPLO },
          { nome: { contains: "Exemplo validação", mode: "insensitive" } },
          { provaId: null },
        ],
      },
      select: { id: true, nome: true },
    });

    const examIds = examsExemplo.map((e) => e.id);

    if (examIds.length > 0) {
      await prisma.exam.deleteMany({ where: { id: { in: examIds } } });
      console.log(`Removidos ${examIds.length} registro(s) de tentativa:`);
      for (const e of examsExemplo) console.log(`  - ${e.nome}`);
    } else {
      console.log("Nenhum simulado de exemplo encontrado para este usuário.");
    }

    const quests = await prisma.quest.deleteMany({ where: { userId: user.id } });
    const planos = await prisma.studyPlan.deleteMany({ where: { userId: user.id } });

    console.log(`Quests removidas: ${quests.count}`);
    console.log(`Planos removidos: ${planos.count}`);
    console.log("Pronto. Registre de novo a partir de Provas públicas.");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
