import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import {
  iterarQuestoesAnoCompleto,
  listarProvasEnem,
} from "@/lib/enem-dev/client";
import type { EnemDevExam } from "@/lib/enem-dev/types";
import {
  mapearQuestaoEstrutural,
  type EnemCorpusEstrutural,
} from "@/lib/enem-dev/estrutural";
import {
  compararManifestoComBanco,
  corpusPrecisaSync,
  type ManifestoCorpus,
  type ValidacaoCorpus,
} from "@/lib/enem-corpus-validacao";
import { zerarCorpusEnem, type ZerarCorpusResultado } from "@/lib/enem-corpus-reset";

export const ENEM_CORPUS_SYNC_VERSION = "1.0";
export const ENEM_CORPUS_RESET_TOKEN = "ZERAR_CORPUS_ENEM";

export type SyncCorpusOpts = {
  anos?: number[];
  dryRun?: boolean;
  onProgress?: (msg: string) => void;
};

export type ResetSyncCorpusOpts = SyncCorpusOpts & {
  reset?: boolean;
};

export type ResetSyncCorpusResultado = SyncCorpusResultado & {
  reset: ZerarCorpusResultado | null;
};

export type SyncCorpusResultado = {
  versao: string;
  processadas: number;
  criadas: number;
  atualizadas: number;
  anos: number[];
  duracaoMs: number;
  avisos: string[];
  manifesto: Omit<ManifestoCorpus, "fonteIds"> & { totalFonteIds: number };
  validacao: ValidacaoCorpus;
};

function rowParaPrisma(row: EnemCorpusEstrutural) {
  return {
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
}

function criarManifestoVazio(): ManifestoCorpus {
  return {
    total: 0,
    porAno: {},
    linguagensPorAno: {},
    linguagensTotais: { comum: 0, ingles: 0, espanhol: 0 },
    fonteIds: new Set(),
  };
}

function registrarNoManifesto(manifesto: ManifestoCorpus, row: EnemCorpusEstrutural) {
  manifesto.fonteIds.add(row.fonteId);
  manifesto.porAno[row.ano] = (manifesto.porAno[row.ano] ?? 0) + 1;

  if (row.disciplina !== "linguagens") return;

  const porAno = manifesto.linguagensPorAno[row.ano] ?? {
    comum: 0,
    ingles: 0,
    espanhol: 0,
  };
  if (row.idioma === "ingles") {
    porAno.ingles++;
    manifesto.linguagensTotais.ingles++;
  } else if (row.idioma === "espanhol") {
    porAno.espanhol++;
    manifesto.linguagensTotais.espanhol++;
  } else {
    porAno.comum++;
    manifesto.linguagensTotais.comum++;
  }
  manifesto.linguagensPorAno[row.ano] = porAno;
}

/** Upsert estrutural — não altera campos de classificação pedagógica (N2). */
export async function upsertQuestaoEstrutural(
  prisma: PrismaClient,
  row: EnemCorpusEstrutural,
  dryRun: boolean
): Promise<"criada" | "atualizada" | "dry"> {
  if (dryRun) return "dry";

  const existente = await prisma.enemQuestaoCorpus.findUnique({
    where: { fonteId: row.fonteId },
    select: { id: true },
  });

  const data = rowParaPrisma(row);

  if (existente) {
    await prisma.enemQuestaoCorpus.update({ where: { id: existente.id }, data });
    return "atualizada";
  }

  await prisma.enemQuestaoCorpus.create({ data });
  return "criada";
}

async function* iterarAnosSync(
  provas: EnemDevExam[],
  anosFiltro?: number[]
): AsyncGenerator<{ ano: number; prova: EnemDevExam }> {
  const mapa = new Map(provas.map((p) => [p.year, p]));
  const anos = (anosFiltro?.length ? anosFiltro : provas.map((p) => p.year)).sort(
    (a, b) => a - b
  );

  for (const ano of anos) {
    const prova = mapa.get(ano);
    if (!prova) continue;
    yield { ano, prova };
  }
}

/**
 * Sincroniza o corpus ENEM 1:1 com enem.dev (listagem padrão + passagem inglês).
 */
export async function sincronizarCorpusEnem(
  prisma: PrismaClient,
  opts: SyncCorpusOpts = {}
): Promise<SyncCorpusResultado> {
  const inicio = Date.now();
  const dryRun = opts.dryRun ?? false;
  const avisos: string[] = [];
  const log = opts.onProgress ?? (() => {});

  const provas = await listarProvasEnem();
  const semIngles = provas
    .filter((p) => !p.languages.some((l) => l.value === "ingles"))
    .map((p) => p.year);
  if (semIngles.length) {
    avisos.push(`Anos sem trilha inglês na API: ${semIngles.join(", ")}.`);
  }

  const manifesto = criarManifestoVazio();
  let processadas = 0;
  let criadas = 0;
  let atualizadas = 0;
  const anosOk: number[] = [];

  for await (const { ano, prova } of iterarAnosSync(provas, opts.anos)) {
    log(`Sincronizando ENEM ${ano}…`);
    let nAno = 0;

    for await (const q of iterarQuestoesAnoCompleto(ano, prova)) {
      const row = mapearQuestaoEstrutural(q);
      registrarNoManifesto(manifesto, row);
      processadas++;
      nAno++;

      const r = await upsertQuestaoEstrutural(prisma, row, dryRun);
      if (r === "criada") criadas++;
      else if (r === "atualizada") atualizadas++;
    }

    if (nAno > 0) anosOk.push(ano);
    log(`  ENEM ${ano}: ${nAno} questões`);
  }

  manifesto.total = manifesto.fonteIds.size;

  const validacao = await compararManifestoComBanco(prisma, manifesto.fonteIds, {
    somenteLeitura: dryRun,
    linguagensApi: manifesto.linguagensTotais,
  });

  if (processadas === 0) {
    throw new Error("Nenhuma questão obtida da API enem.dev — verifique conectividade.");
  }

  if (manifesto.total !== processadas) {
    avisos.push(
      `Contagem divergente: fonteIds únicos=${manifesto.total}, linhas processadas=${processadas}.`
    );
  }

  const { fonteIds: _omit, ...manifestoResumo } = manifesto;

  return {
    versao: ENEM_CORPUS_SYNC_VERSION,
    processadas,
    criadas,
    atualizadas,
    anos: anosOk,
    duracaoMs: Date.now() - inicio,
    avisos,
    manifesto: { ...manifestoResumo, totalFonteIds: manifesto.fonteIds.size },
    validacao,
  };
}

export { corpusPrecisaSync, construirManifestoApi } from "@/lib/enem-corpus-validacao";
export { zerarCorpusEnem } from "@/lib/enem-corpus-reset";

/**
 * Zera o banco e importa de novo da API — começo limpo sem dados legados errados.
 */
export async function resetarESincronizarCorpusEnem(
  prisma: PrismaClient,
  opts: SyncCorpusOpts = {}
): Promise<ResetSyncCorpusResultado> {
  const reset = await zerarCorpusEnem(prisma);
  const resultado = await sincronizarCorpusEnem(prisma, opts);
  return { ...resultado, reset };
}
