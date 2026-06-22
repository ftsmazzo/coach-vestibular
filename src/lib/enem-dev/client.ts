import type { EnemDevExam, EnemDevQuestionsPage } from "./types";

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
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`enem.dev ${path}: HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function listarProvasEnem(): Promise<EnemDevExam[]> {
  return fetchJson<EnemDevExam[]>("/exams");
}

export async function listarQuestoesAno(
  ano: number,
  limit = DEFAULT_PAGE_SIZE,
  offset = 0
): Promise<EnemDevQuestionsPage> {
  return fetchJson<EnemDevQuestionsPage>(
    `/exams/${ano}/questions?limit=${limit}&offset=${offset}`
  );
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
