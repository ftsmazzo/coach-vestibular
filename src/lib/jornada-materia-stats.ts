import type { AreaBlocoId } from "@/lib/areas-bloco";
import { areaBlocoIdDeLabel, inferirAreaBlocoPorMateria, normalizarAreaBloco } from "@/lib/areas-bloco";
import { mapMateriaAssuntoToTaxonomy } from "@/lib/prova-catalog";
import { getMateriaLabel } from "@/lib/taxonomy";

type AttemptLike = {
  correto: boolean;
  materiaId: string | null;
  provaQuestao?: { materia: string; assunto: string; areaBloco: string | null } | null;
};

export function materiaIdDeAttempt(q: AttemptLike): string | null {
  if (q.materiaId) return q.materiaId;
  if (!q.provaQuestao) return null;
  return (
    mapMateriaAssuntoToTaxonomy(q.provaQuestao.materia, q.provaQuestao.assunto).materiaId ?? null
  );
}

export function areaBlocoIdDeAttempt(q: AttemptLike): AreaBlocoId | null {
  const materiaId = materiaIdDeAttempt(q);
  const materiaNome =
    q.provaQuestao?.materia?.trim() || (materiaId ? getMateriaLabel(materiaId) : null);
  const canon = normalizarAreaBloco(q.provaQuestao?.areaBloco, materiaNome);
  return areaBlocoIdDeLabel(canon);
}

/** % de acerto na matéria naquele exame; null se não houve questão da matéria. */
export function pctMateriaNoExame(
  attempts: AttemptLike[],
  materiaId: string
): { pct: number; total: number } | null {
  let acertos = 0;
  let total = 0;
  for (const q of attempts) {
    const mid = materiaIdDeAttempt(q);
    if (mid !== materiaId) continue;
    total++;
    if (q.correto) acertos++;
  }
  if (total === 0) return null;
  return { pct: Math.round((acertos / total) * 100), total };
}

/** Matérias com pelo menos 1 questão no exame. */
export function materiasNoExame(attempts: AttemptLike[]): string[] {
  const set = new Set<string>();
  for (const q of attempts) {
    const mid = materiaIdDeAttempt(q);
    if (mid) set.add(mid);
  }
  return [...set];
}
