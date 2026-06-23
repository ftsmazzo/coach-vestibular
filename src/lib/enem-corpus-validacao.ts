import type { PrismaClient } from "@/generated/prisma/client";
import {
  iterarQuestoesAnoCompleto,
  listarProvasEnem,
} from "@/lib/enem-dev/client";
import type { EnemDevExam } from "@/lib/enem-dev/types";
import { mapearQuestaoEstrutural } from "@/lib/enem-dev/estrutural";
import { ENEM_CORPUS_MINIMO } from "@/lib/enem-corpus-stats";
import { L2_INGLES_MINIMO_ESPERADO, contarInglesLinguagensCorpus } from "@/lib/enem-import-l2-ingles";

export type ManifestoCorpus = {
  total: number;
  porAno: Record<number, number>;
  linguagensPorAno: Record<
    number,
    { comum: number; ingles: number; espanhol: number }
  >;
  linguagensTotais: { comum: number; ingles: number; espanhol: number };
  fonteIds: Set<string>;
};

export type ValidacaoItem = {
  ok: boolean;
  nivel: "E0" | "E1" | "info";
  mensagem: string;
};

export type ValidacaoCorpus = {
  completo: boolean;
  totalApi: number;
  totalBanco: number;
  delta: number;
  faltando: string[];
  extras: string[];
  anomalias: Array<{ tipo: string; fonteId?: string; msg: string }>;
  linguagens: {
    api: { comum: number; ingles: number; espanhol: number };
    banco: { comum: number; ingles: number; espanhol: number };
  };
  itens: ValidacaoItem[];
};

export type ValidacaoEstruturalBanco = {
  completo: boolean;
  total: number;
  itens: ValidacaoItem[];
  linguagens: { comum: number; ingles: number; espanhol: number };
  anomaliasQ1a5Comum: number;
};

function bumpIdioma(
  map: Record<number, { comum: number; ingles: number; espanhol: number }>,
  ano: number,
  idioma: "COMUM" | "ingles" | "espanhol"
) {
  if (!map[ano]) map[ano] = { comum: 0, ingles: 0, espanhol: 0 };
  if (idioma === "ingles") map[ano].ingles++;
  else if (idioma === "espanhol") map[ano].espanhol++;
  else map[ano].comum++;
}

/** Coleta manifesto esperado da API (sem gravar no banco). */
export async function construirManifestoApi(opts?: {
  provas?: EnemDevExam[];
  anos?: number[];
  onAno?: (ano: number, count: number) => void;
}): Promise<ManifestoCorpus> {
  const provas = opts?.provas ?? (await listarProvasEnem());
  const mapa = new Map(provas.map((p) => [p.year, p]));
  const anos = (opts?.anos?.length ? opts.anos : provas.map((p) => p.year)).sort(
    (a, b) => a - b
  );

  const fonteIds = new Set<string>();
  const porAno: Record<number, number> = {};
  const linguagensPorAno: ManifestoCorpus["linguagensPorAno"] = {};
  const linguagensTotais = { comum: 0, ingles: 0, espanhol: 0 };

  for (const ano of anos) {
    const prova = mapa.get(ano);
    if (!prova) continue;

    let n = 0;
    for await (const q of iterarQuestoesAnoCompleto(ano, prova)) {
      const row = mapearQuestaoEstrutural(q);
      fonteIds.add(row.fonteId);
      n++;
      if (row.disciplina === "linguagens") {
        bumpIdioma(linguagensPorAno, ano, row.idioma);
        if (row.idioma === "ingles") linguagensTotais.ingles++;
        else if (row.idioma === "espanhol") linguagensTotais.espanhol++;
        else linguagensTotais.comum++;
      }
    }
    porAno[ano] = n;
    opts?.onAno?.(ano, n);
  }

  return {
    total: fonteIds.size,
    porAno,
    linguagensPorAno,
    linguagensTotais,
    fonteIds,
  };
}

async function contarLinguagensBanco(prisma: PrismaClient) {
  const rows = await prisma.enemQuestaoCorpus.groupBy({
    by: ["idioma"],
    where: { disciplina: "linguagens" },
    _count: { _all: true },
  });

  const map = Object.fromEntries(rows.map((r) => [r.idioma, r._count._all])) as Record<
    string,
    number
  >;

  return {
    comum: map.COMUM ?? 0,
    ingles: map.ingles ?? 0,
    espanhol: map.espanhol ?? 0,
  };
}

/** Compara manifesto da API com o banco. */
export async function compararManifestoComBanco(
  prisma: PrismaClient,
  fonteIdsApi: Set<string>,
  opts?: {
    somenteLeitura?: boolean;
    maxDiff?: number;
    linguagensApi?: { comum: number; ingles: number; espanhol: number };
  }
): Promise<ValidacaoCorpus> {
  const maxDiff = opts?.maxDiff ?? 50;
  const rows = await prisma.enemQuestaoCorpus.findMany({
    where: { fonte: "enem.dev" },
    select: { fonteId: true, idioma: true, disciplina: true, numero: true },
  });

  const bancoIds = new Set(rows.map((r) => r.fonteId));
  const faltando: string[] = [];
  const extras: string[] = [];

  for (const id of fonteIdsApi) {
    if (!bancoIds.has(id) && faltando.length < maxDiff) faltando.push(id);
  }
  for (const id of bancoIds) {
    if (!fonteIdsApi.has(id) && extras.length < maxDiff) extras.push(id);
  }

  const anomalias: ValidacaoCorpus["anomalias"] = [];

  const q1a5Comum = await prisma.enemQuestaoCorpus.count({
    where: {
      disciplina: "linguagens",
      idioma: "COMUM",
      numero: { lte: 5 },
    },
  });
  if (q1a5Comum > 0) {
    anomalias.push({
      tipo: "linguagens_q1_5_comum",
      msg: `${q1a5Comum} questões Linguagens Q1–5 com idioma COMUM (esperado EN ou ES).`,
    });
  }

  for (const r of rows) {
    const sufixo = r.fonteId.split(":").pop();
    if (sufixo && sufixo !== r.idioma) {
      if (anomalias.length < maxDiff) {
        anomalias.push({
          tipo: "fonte_id_idioma",
          fonteId: r.fonteId,
          msg: `fonteId termina em ${sufixo} mas idioma=${r.idioma}`,
        });
      }
    }
  }

  const linguagensBanco = await contarLinguagensBanco(prisma);
  const linguagensApi =
    opts?.linguagensApi ??
    (await construirManifestoApi()).linguagensTotais;

  const totalApi = fonteIdsApi.size;
  const totalBanco = bancoIds.size;
  const delta = totalBanco - totalApi;
  const completo =
    faltando.length === 0 && extras.length === 0 && anomalias.length === 0 && delta === 0;

  const itens: ValidacaoItem[] = [
    {
      ok: faltando.length === 0,
      nivel: "E0",
      mensagem:
        faltando.length === 0
          ? `API e banco alinhados (${totalApi} fonteIds).`
          : `Faltam ${faltando.length}${faltando.length >= maxDiff ? "+" : ""} questões no banco.`,
    },
    {
      ok: extras.length === 0,
      nivel: "E1",
      mensagem:
        extras.length === 0
          ? "Sem registros órfãos no banco."
          : `${extras.length}${extras.length >= maxDiff ? "+" : ""} fonteIds no banco ausentes na API.`,
    },
    {
      ok: q1a5Comum === 0,
      nivel: "E0",
      mensagem:
        q1a5Comum === 0
          ? "Linguagens Q1–5 sem anomalia COMUM."
          : `${q1a5Comum} Linguagens Q1–5 com idioma COMUM.`,
    },
    {
      ok: linguagensBanco.ingles >= L2_INGLES_MINIMO_ESPERADO,
      nivel: "E0",
      mensagem: `Inglês no banco: ${linguagensBanco.ingles} (meta ≥ ${L2_INGLES_MINIMO_ESPERADO}, API ≈ ${linguagensApi.ingles}).`,
    },
  ];

  return {
    completo,
    totalApi,
    totalBanco,
    delta,
    faltando,
    extras,
    anomalias,
    linguagens: { api: linguagensApi, banco: linguagensBanco },
    itens,
  };
}

/** Validação rápida só no banco (sem chamar API) — para GET admin e --if-incomplete. */
export async function validarCorpusEstruturalBanco(
  prisma: PrismaClient
): Promise<ValidacaoEstruturalBanco> {
  const total = await prisma.enemQuestaoCorpus.count();
  const linguagens = await contarLinguagensBanco(prisma);
  const ingles = await contarInglesLinguagensCorpus(prisma);

  const anomaliasQ1a5Comum = await prisma.enemQuestaoCorpus.count({
    where: {
      disciplina: "linguagens",
      idioma: "COMUM",
      numero: { lte: 5 },
    },
  });

  const itens: ValidacaoItem[] = [
    {
      ok: total >= ENEM_CORPUS_MINIMO,
      nivel: "E0",
      mensagem: `Total no banco: ${total} (meta ≥ ${ENEM_CORPUS_MINIMO}).`,
    },
    {
      ok: ingles >= L2_INGLES_MINIMO_ESPERADO,
      nivel: "E0",
      mensagem: `Inglês Linguagens: ${ingles} (meta ≥ ${L2_INGLES_MINIMO_ESPERADO}).`,
    },
    {
      ok: anomaliasQ1a5Comum === 0,
      nivel: "E0",
      mensagem:
        anomaliasQ1a5Comum === 0
          ? "Sem Linguagens Q1–5 com idioma COMUM."
          : `${anomaliasQ1a5Comum} anomalias Q1–5 COMUM.`,
    },
    {
      ok: true,
      nivel: "info",
      mensagem: `Trilhas Linguagens — PT(COMUM): ${linguagens.comum}, EN: ${linguagens.ingles}, ES: ${linguagens.espanhol}.`,
    },
  ];

  const completo = itens.filter((i) => i.nivel === "E0").every((i) => i.ok);

  return { completo, total, itens, linguagens, anomaliasQ1a5Comum };
}

export async function corpusPrecisaSync(prisma: PrismaClient): Promise<boolean> {
  const v = await validarCorpusEstruturalBanco(prisma);
  return !v.completo;
}
