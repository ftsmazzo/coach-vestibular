/**
 * Seed autossuficiente — não importa src/lib (seguro no Docker de produção).
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
function createPrisma() {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("postgresql")) {
    throw new Error("DATABASE_URL PostgreSQL é obrigatória para o seed.");
  }
  const pool = new Pool({ connectionString: url });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

async function main() {
  if (process.env.RUN_SEED !== "true" && process.env.NODE_ENV === "production") {
    console.log("Seed ignorado (defina RUN_SEED=true para executar em produção).");
    return;
  }

  const prisma = createPrisma();

  try {
    const existingUsers = await prisma.user.count();
    if (existingUsers > 0) {
      console.log("Banco já possui dados — seed ignorado (idempotente).");
      return;
    }

    await prisma.inviteCode.createMany({
      data: [
        { code: "MED2026-BETA", maxUses: 10 },
        { code: "COACH-FAMILIA", maxUses: 5 },
      ],
    });

    const passwordHash = await bcrypt.hash("demo1234", 10);

    const admin = await prisma.user.create({
      data: {
        email: "admin@coach.local",
        passwordHash,
        name: "Admin",
        role: "ADMIN",
      },
    });

    const student = await prisma.user.create({
      data: {
        email: "aluna@coach.local",
        passwordHash,
        name: "Estudante Demo",
        vestibularAlvo: "Medicina",
        metaProva: "ENEM 2026",
      },
    });

    console.log("Seed OK (sem simulado de exemplo — use Provas públicas para registrar)");
    console.log("Admin:", admin.email, "senha: demo1234");
    console.log("Aluna:", student.email, "senha: demo1234");
    console.log("Convites: MED2026-BETA, COACH-FAMILIA");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
