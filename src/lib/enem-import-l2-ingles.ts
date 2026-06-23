import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { iterarQuestoesL2Ingles, listarProvasEnem } from "@/lib/enem-dev/client";
import { mapearQuestaoEstrutural } from "@/lib/enem-dev/estrutural";

export type ImportL2InglesResultado = {
  processadas: number;
  criadas: number;
  atualizadas: number;
  anos: number[];
};

async function upsertQuestaoCorpus(
  prisma: PrismaClient,
  row: ReturnType<typeof mapearQuestaoEstrutural>,
  dryRun: boolean
): Promise<"criada" | "atualizada" | "dry"> {
  if (dryRun) return "dry";

  const existente = await prisma.enemQuestaoCorpus.findUnique({
    where: { fonteId: row.fonteId },
    select: { id: true },
  });

  const data = {
    ano: row.ano,
    numero: row.numero,
    idioma: row.idioma,
    dia: row.dia,
    disciplina: row.disciplina,
    titulo: row.titulo,
    enunciadoMd: row.enunciadoMd,
    introducaoAlternativas: row.introducaoAlternativas,
    alternativas: row.alternativas as Prisma.InputJsonValue,
    gabarito: row.gabarito,
    arquivos: row.arquivos === null ? Prisma.JsonNull : (row.arquivos as Prisma.InputJsonValue),
    areaBloco: row.areaBloco,
    fonte: "enem.dev",
    fonteId: row.fonteId,
  };

  if (existente) {
    await prisma.enemQuestaoCorpus.update({ where: { id: existente.id }, data });
    return "atualizada";
  }

  await prisma.enemQuestaoCorpus.create({ data });
  return "criada";
}

/**
 * Importa variantes inglês Q1–5 via enem.dev `?language=ingles`.
 * A listagem paginada padrão só traz espanhol (Q1–5) + português (Q6+).
 */
export async function importarL2InglesCorpus(
  prisma: PrismaClient,
  opts: { anos?: number[]; dryRun?: boolean } = {}
): Promise<ImportL2InglesResultado> {
  const dryRun = opts.dryRun ?? false;
  const anos =
    opts.anos?.length ? opts.anos : (await listarProvasEnem()).map((p) => p.year).sort((a, b) => a - b);

  let processadas = 0;
  let criadas = 0;
  let atualizadas = 0;
  const anosOk: number[] = [];

  for (const ano of anos) {
    let nAno = 0;
    for await (const q of iterarQuestoesL2Ingles(ano)) {
      const row = mapearQuestaoEstrutural(q);
      if (row.idioma !== "ingles") continue;

      processadas++;
      nAno++;
      const r = await upsertQuestaoCorpus(prisma, row, dryRun);
      if (r === "criada") criadas++;
      else if (r === "atualizada") atualizadas++;
    }
    if (nAno > 0) anosOk.push(ano);
  }

  return { processadas, criadas, atualizadas, anos: anosOk };
}
