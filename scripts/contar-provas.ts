/** Imprime só o número de provas (stdout) — usado pelo docker-entrypoint. */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const count = await prisma.prova.count();
process.stdout.write(String(count));
await prisma.$disconnect();
