import "dotenv/config";
import bcrypt from "bcryptjs";
import exemploSimulado from "../data/exemplo-simulado.json";
import { buildDiagnosis } from "../src/lib/diagnosis";
import { generateStudyPlan, planToQuests } from "../src/lib/study-plan";
import { prisma } from "../src/lib/prisma";

async function main() {
  if (process.env.RUN_SEED !== "true" && process.env.NODE_ENV === "production") {
    console.log("Seed ignorado (defina RUN_SEED=true para executar em produção).");
    return;
  }

  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    console.log("Banco já possui dados — seed ignorado (idempotente).");
    return;
  }

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
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
