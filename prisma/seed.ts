import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";
import path from "path";
import exemploSimulado from "../data/exemplo-simulado.json";
import { buildDiagnosis } from "../src/lib/diagnosis";
import { generateStudyPlan, planToQuests } from "../src/lib/study-plan";

const raw = process.env.DATABASE_URL ?? "file:./dev.db";
const filePath = raw.replace(/^file:/, "");
const dbPath = path.isAbsolute(filePath)
  ? filePath
  : path.join(process.cwd(), path.basename(filePath));
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.quest.deleteMany();
  await prisma.studyPlan.deleteMany();
  await prisma.diagnosticSnapshot.deleteMany();
  await prisma.emotionalLog.deleteMany();
  await prisma.questionAttempt.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.uploadJob.deleteMany();
  await prisma.inviteCode.deleteMany();
  await prisma.user.deleteMany();

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

  const questoes = exemploSimulado.questoes.map((q) => ({
    numero: q.numero,
    correto: q.correto,
    materiaId: q.materiaId,
    temaId: q.temaId,
    tipoErro: (q.tipoErro as "base_teorica" | "interpretacao" | "atencao" | undefined) ?? null,
  }));

  const diagnosis = buildDiagnosis(questoes, [], {
    checkInScore: exemploSimulado.checkInEmocional,
  });

  const exam = await prisma.exam.create({
    data: {
      userId: student.id,
      nome: exemploSimulado.nome,
      data: new Date(exemploSimulado.data),
      banca: exemploSimulado.banca,
      totalQuestoes: exemploSimulado.totalQuestoes,
      nota: exemploSimulado.nota,
      checkInScore: exemploSimulado.checkInEmocional,
      recoveryMode: diagnosis.recoveryMode,
      questionAttempts: { create: questoes },
      diagnosticSnapshot: {
        create: {
          userId: student.id,
          scoresJson: JSON.stringify({
            overallAcerto: diagnosis.overallAcerto,
            materiaScores: diagnosis.materiaScores,
            temaScores: diagnosis.temaScores,
          }),
          focosJson: JSON.stringify(diagnosis.focos),
          mensagem: diagnosis.mensagem,
          recoveryMode: diagnosis.recoveryMode,
        },
      },
      emotionalLog: {
        create: { userId: student.id, score: exemploSimulado.checkInEmocional },
      },
    },
  });

  const { items, recoveryMode } = generateStudyPlan(diagnosis);
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);

  await prisma.studyPlan.create({
    data: {
      userId: student.id,
      weekStart,
      itemsJson: JSON.stringify(items),
      recoveryMode,
    },
  });

  await prisma.quest.createMany({ data: planToQuests(items, student.id) });

  console.log("Seed OK");
  console.log("Admin:", admin.email, "senha: demo1234");
  console.log("Aluna:", student.email, "senha: demo1234");
  console.log("Convites: MED2026-BETA, COACH-FAMILIA");
  console.log("Exemplo simulado:", exam.id);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
