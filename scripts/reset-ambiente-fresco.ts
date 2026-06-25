/**
 * Reset motor v1 — mantém logins (User), zera jornada e apaga catálogo/corpus.
 *
 * Mantém: contas User (alunos + admin), convites, perfil básico (nome, e-mail, meta).
 * Apaga: exams, planos, quests, ciclos, XP events, anamnese, feedback, uploads,
 *        catálogo Prova/ProvaQuestao, corpus EnemQuestaoCorpus.
 * Zera: xp dos alunos (como recém-cadastrados, sem pedir novo login).
 *
 * Uso: CONFIRMAR_RESET=true npx tsx scripts/reset-ambiente-fresco.ts
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";

const EMAILS_ADMIN_ANTIGOS = (
  process.env.ADMIN_EMAIL_ANTIGO ?? "admin@coach.local"
)
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

function createPrisma() {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("postgresql")) {
    throw new Error("DATABASE_URL PostgreSQL é obrigatória.");
  }
  const pool = new Pool({ connectionString: url });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

async function garantirAdmin(prisma: PrismaClient) {
  const adminEmail = process.env.ADMIN_EMAIL ?? "fredmazzo@gmail.com";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "Fs142779@1524";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const existente = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existente?.role === "ADMIN") {
    await prisma.user.update({
      where: { id: existente.id },
      data: { passwordHash, name: existente.name || "Admin", role: "ADMIN" },
    });
    return adminEmail;
  }

  for (const email of EMAILS_ADMIN_ANTIGOS) {
    const antigo = await prisma.user.findUnique({ where: { email } });
    if (antigo?.role === "ADMIN") {
      await prisma.user.update({
        where: { id: antigo.id },
        data: { email: adminEmail, passwordHash, name: antigo.name || "Admin", role: "ADMIN" },
      });
      return adminEmail;
    }
  }

  const qualquerAdmin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (qualquerAdmin) {
    await prisma.user.update({
      where: { id: qualquerAdmin.id },
      data: { email: adminEmail, passwordHash, name: qualquerAdmin.name || "Admin", role: "ADMIN" },
    });
    return adminEmail;
  }

  await prisma.user.create({
    data: { email: adminEmail, passwordHash, name: "Admin", role: "ADMIN" },
  });
  return adminEmail;
}

async function main() {
  if (process.env.CONFIRMAR_RESET !== "true") {
    console.error("Abortado. Defina CONFIRMAR_RESET=true para executar o reset.");
    process.exit(1);
  }

  const prisma = createPrisma();

  try {
    const alunosAntes = await prisma.user.count({ where: { role: "STUDENT" } });
    const provasAntes = await prisma.prova.count();
    const corpusAntes = await prisma.enemQuestaoCorpus.count();

    console.log(`Alunos a preservar (login): ${alunosAntes}`);
    console.log(`Provas no catálogo (serão apagadas): ${provasAntes}`);
    console.log(`Corpus ENEM (será apagado): ${corpusAntes}`);

    console.log("1/3 — Apagando jornada dos alunos…");
    await prisma.cicloQuiz.deleteMany();
    await prisma.learningCycle.deleteMany();
    await prisma.quest.deleteMany();
    await prisma.studyPlan.deleteMany();
    await prisma.diagnosticSnapshot.deleteMany();
    await prisma.sugestaoClassificacao.deleteMany();
    await prisma.questionAttempt.deleteMany();
    await prisma.exam.deleteMany();
    await prisma.emotionalLog.deleteMany();
    await prisma.userXpEvent.deleteMany();
    await prisma.feedback.deleteMany();
    await prisma.studentAnamnesis.deleteMany();
    await prisma.uploadJob.deleteMany();

    console.log("2/3 — Apagando catálogo de provas e corpus ENEM…");
    await prisma.provaQuestao.deleteMany();
    await prisma.prova.deleteMany();
    await prisma.enemQuestaoCorpus.deleteMany();

    console.log("3/3 — Zerando XP (contas preservadas) e atualizando admin…");
    const xpReset = await prisma.user.updateMany({
      where: { role: "STUDENT" },
      data: { xp: 0 },
    });
    const adminEmail = await garantirAdmin(prisma);

    const alunosDepois = await prisma.user.count({ where: { role: "STUDENT" } });

    console.log("");
    console.log("Reset concluído.");
    console.log(`  Alunos (mesmo login): ${alunosDepois} (${xpReset.count} com XP zerado)`);
    console.log(`  Admin: ${adminEmail}`);
    console.log("  Catálogo Prova/ProvaQuestao: vazio");
    console.log("  Corpus ENEM: vazio");
    console.log("");
    console.log("Alunos entram com o mesmo e-mail/senha — jornada zerada, como no primeiro dia.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
