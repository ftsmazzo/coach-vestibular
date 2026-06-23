import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import {
  anosComL2Ingles,
  buscarQuestaoEnem,
  iterarQuestoesL2Ingles,
  listarProvasEnem,
} from "@/lib/enem-dev/client";
import { mapearQuestaoEstrutural } from "@/lib/enem-dev/estrutural";

export type ImportL2InglesResultado = {
  processadas: number;
  criadas: number;
  atualizadas: number;
  anos: number[];
  avisos: string[];
};

/** Mínimo esperado de questões EN Q1–5 no corpus (~13 anos × 5; 2009 e 2011 sem inglês na API). */
export const L2_INGLES_MINIMO_ESPERADO = 50;

export async function contarInglesLinguagensCorpus(prisma: PrismaClient): Promise<number> {
  return prisma.enemQuestaoCorpus.count({
    where: { disciplina: "linguagens", idioma: "ingles" },
  });
}

/** Testa conectividade com enem.dev antes do import em lote. */
export async function testarAcessoEnemDevIngles(): Promise<void> {
  const q = await buscarQuestaoEnem(2023, 1, "ingles");
  if (q.discipline !== "linguagens" || q.language !== "ingles") {
    throw new Error(
      `enem.dev retornou formato inesperado (discipline=${q.discipline}, language=${q.language})`
    );
  }
}

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
  opts: { anos?: number[]; dryRun?: boolean; pularSeJaTem?: boolean } = {}
): Promise<ImportL2InglesResultado> {
  const dryRun = opts.dryRun ?? false;
  const avisos: string[] = [];

  if (opts.pularSeJaTem) {
    const jaTem = await contarInglesLinguagensCorpus(prisma);
    if (jaTem >= L2_INGLES_MINIMO_ESPERADO) {
      avisos.push(`Corpus já tem ${jaTem} questões EN — import ignorado.`);
      return { processadas: 0, criadas: 0, atualizadas: 0, anos: [], avisos };
    }
    avisos.push(`EN no banco: ${jaTem} (meta ≥ ${L2_INGLES_MINIMO_ESPERADO}).`);
  }

  await testarAcessoEnemDevIngles();

  const provas = await listarProvasEnem();
  const anosComEn = anosComL2Ingles(provas);
  const anos = opts.anos?.length
    ? opts.anos.filter((a) => anosComEn.includes(a))
    : anosComEn;

  const semIngles = provas.filter((p) => !p.languages.some((l) => l.value === "ingles")).map((p) => p.year);
  if (semIngles.length > 0) {
    avisos.push(`Anos sem inglês na API (ignorados): ${semIngles.join(", ")}.`);
  }

  if (anos.length === 0) {
    throw new Error("Nenhum ano com trilha inglês na API enem.dev.");
  }

  let processadas = 0;
  let criadas = 0;
  let atualizadas = 0;
  const anosOk: number[] = [];

  for (const ano of anos) {
    let nAno = 0;
    for await (const q of iterarQuestoesL2Ingles(ano)) {
      const row = mapearQuestaoEstrutural(q);
      if (row.idioma !== "ingles") {
        avisos.push(`${ano} Q${row.numero}: idioma ${row.idioma} ignorado.`);
        continue;
      }

      processadas++;
      nAno++;
      const r = await upsertQuestaoCorpus(prisma, row, dryRun);
      if (r === "criada") criadas++;
      else if (r === "atualizada") atualizadas++;
    }
    if (nAno > 0) anosOk.push(ano);
  }

  if (processadas === 0) {
    throw new Error(
      `Nenhuma questão inglês Q1–5 importada (${anos.length} anos consultados). ` +
        "Confira se o servidor acessa https://api.enem.dev e tente de novo."
    );
  }

  if (criadas === 0 && atualizadas > 0) {
    avisos.push("Todas as questões EN já existiam — apenas atualizadas.");
  }

  return { processadas, criadas, atualizadas, anos: anosOk, avisos };
}
