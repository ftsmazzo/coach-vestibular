import { parseClassificacaoN1 } from "@/lib/classificacao-n1-types";
import { opcoesCatalogoN1 } from "@/lib/catalogos-n1-destino";

export type QuestaoN1Source = {
  classificacaoN1Json?: string | null;
  classificacaoVersao?: string | null;
  materia?: string | null;
};

/** Extrai cat= do classificacaoVersao (n1-v1|area=…|cat=quimica|…). */
export function catalogoIdDeVersaoN1(versao: string | null | undefined): string | null {
  if (!versao?.trim()) return null;
  const m = versao.match(/(?:^|\|)cat=([^|]+)/);
  return m?.[1]?.trim() || null;
}

/** Resolve o catálogo N1 destino a partir de JSON, versão ou matéria legada. */
export function resolverCatalogoN1Questao(q: QuestaoN1Source): string {
  const n1 = parseClassificacaoN1(q.classificacaoN1Json);
  if (n1?.catalogoId) return n1.catalogoId;

  const daVersao = catalogoIdDeVersaoN1(q.classificacaoVersao);
  if (daVersao && opcoesCatalogoN1().some((o) => o.id === daVersao)) {
    return daVersao;
  }

  const mat = q.materia?.trim().toLowerCase();
  if (mat) {
    const porLabel = opcoesCatalogoN1().find(
      (o) =>
        o.label.toLowerCase() === mat ||
        o.id.toLowerCase() === mat ||
        mat.includes(o.label.toLowerCase())
    );
    if (porLabel) return porLabel.id;
  }

  return "";
}

export function assuntoEhPlaceholderN1(assunto: string | null | undefined): boolean {
  return Boolean(assunto?.trim().match(/^N1:\s*\S+/i));
}
