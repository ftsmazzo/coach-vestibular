import type { EnemDevExam, EnemDevLanguage, EnemDevQuestionsPage } from "./types";

const BASE_URL = "https://api.enem.dev/v1";
const DEFAULT_PAGE_SIZE = 50;
const MIN_INTERVAL_MS = 1100;

let lastRequestAt = 0;

async function throttle(): Promise<void> {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, MIN_INTERVAL_MS - elapsed));
  }
  lastRequestAt = Date.now();
}

async function fetchJson<T>(path: string): Promise<T> {
  await throttle();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "coach-vestibular/1.0",
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`enem.dev ${path}: HTTP ${res.status}${body ? ` — ${body.slice(0, 120)}` : ""}`);
  }
  return res.json() as Promise<T>;
}

export async function listarProvasEnem(): Promise<EnemDevExam[]> {
  return fetchJson<EnemDevExam[]>("/exams");
}

export async function listarQuestoesAno(
  ano: number,
  limit = DEFAULT_PAGE_SIZE,
  offset = 0,
  language?: EnemDevLanguage
): Promise<EnemDevQuestionsPage> {
  const lang = language ? `&language=${language}` : "";
  return fetchJson<EnemDevQuestionsPage>(
    `/exams/${ano}/questions?limit=${limit}&offset=${offset}${lang}`
  );
}

/** Questão individual — use `language=ingles` na faixa L2 (Q1–5 linguagens). */
export async function buscarQuestaoEnem(
  ano: number,
  index: number,
  language?: EnemDevLanguage
): Promise<EnemDevQuestionsPage["questions"][number]> {
  const lang = language ? `?language=${language}` : "";
  return fetchJson(`/exams/${ano}/questions/${index}${lang}`);
}

/** Variante inglês Q1–5 (não vem na listagem paginada padrão do enem.dev). */
export async function* iterarQuestoesL2Ingles(
  ano: number
): AsyncGenerator<EnemDevQuestionsPage["questions"][number]> {
  for (let index = 1; index <= 5; index++) {
    try {
      const q = await buscarQuestaoEnem(ano, index, "ingles");
      if (q.discipline === "linguagens") yield q;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("404")) throw e;
    }
  }
}

/** Itera todas as questões de um ano respeitando paginação e rate limit. */
export async function* iterarQuestoesAno(
  ano: number,
  pageSize = DEFAULT_PAGE_SIZE
): AsyncGenerator<EnemDevQuestionsPage["questions"][number]> {
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const page = await listarQuestoesAno(ano, pageSize, offset);
    for (const q of page.questions) {
      yield q;
    }
    hasMore = page.metadata.hasMore;
    offset += page.metadata.limit;
  }
}
