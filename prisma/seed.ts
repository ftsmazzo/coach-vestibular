/**
 * Seed autossuficiente — admin + 2 alunos (motor v1, sem dados legados).
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
      console.log("Para reset motor v1: CONFIRMAR_RESET=true npx tsx scripts/reset-ambiente-fresco.ts");
      return;
    }

    await prisma.inviteCode.createMany({
      data: [
        { code: "MED2026-BETA", maxUses: 10 },
        { code: "COACH-FAMILIA", maxUses: 5 },
      ],
    });

    const adminPassword = process.env.ADMIN_PASSWORD ?? "Fs142779@1524";
    const adminEmail = process.env.ADMIN_EMAIL ?? "fredmazzo@gmail.com";
    const demoPassword = process.env.DEMO_STUDENT_PASSWORD ?? "demo1234";

    const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
    const demoPasswordHash = await bcrypt.hash(demoPassword, 10);

    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: adminPasswordHash,
        name: "Admin",
        role: "ADMIN",
      },
    });

    const aluna = await prisma.user.create({
      data: {
        email: "aluna@coach.local",
        passwordHash: demoPasswordHash,
        name: "Estudante Demo 1",
        vestibularAlvo: "Medicina",
        metaProva: "ENEM 2026",
      },
    });

    const aluno2 = await prisma.user.create({
      data: {
        email: "aluno2@coach.local",
        passwordHash: demoPasswordHash,
        name: "Estudante Demo 2",
        vestibularAlvo: "Medicina",
        metaProva: "ENEM 2026",
      },
    });

    console.log("Seed OK — motor v1, sem simulados legados.");
    console.log("Admin:", admin.email);
    console.log("Aluna:", aluna.email);
    console.log("Aluno 2:", aluno2.email);
    console.log("Convites: MED2026-BETA, COACH-FAMILIA");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
