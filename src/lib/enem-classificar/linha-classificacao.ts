import type { ClassificacaoN1 } from "@/lib/classificacao-n1-types";
import { labelCatalogoN1 } from "@/lib/catalogos-n1-destino";
import { indexGlobalEscopos } from "@/lib/conhecimento-catalog/load";

export type LinhaClassificacaoInput = {
  n1?: ClassificacaoN1 | null;
  escopoN2Id?: string | null;
};

/** Segmento legível do N1 gravado (catálogo destino + confiança). */
export function formatarSegmentoN1(n1: ClassificacaoN1): string {
  const label = labelCatalogoN1(n1.catalogoId);
  const extras: string[] = [];
  if (n1.rota?.disciplinaId) extras.push(`rota ${n1.rota.disciplinaId}`);
  if (n1.triagemNatureza?.materia) extras.push(`triagem ${n1.triagemNatureza.materia}`);
  const sufixo = extras.length ? ` · ${extras.join(" · ")}` : "";
  return `N1: ${n1.area} → ${n1.catalogoId} (${label}) · conf=${n1.confianca.toFixed(2)}${sufixo}`;
}

/** Segmento legível do N2 gravado (id + label + trecho da descrição do catálogo). */
export function formatarSegmentoN2(escopoId: string): string {
  const entry = indexGlobalEscopos().get(escopoId);
  const label = entry?.escopoLabel ?? escopoId;
  const desc = entry?.descricao?.trim();
  let line = `N2: ${escopoId} — ${label}`;
  if (desc) {
    const trecho = desc.length > 300 ? `${desc.slice(0, 297)}…` : desc;
    line += `\n     Âncora catálogo: ${trecho}`;
  }
  return line;
}

/** Uma linha resumida para logs/UI: área → catálogo → escopo. */
export function formatarLinhaResumida(input: LinhaClassificacaoInput): string {
  const partes: string[] = [];
  if (input.n1) {
    partes.push(input.n1.catalogoId);
  }
  if (input.escopoN2Id?.trim()) {
    partes.push(input.escopoN2Id.trim());
  }
  return partes.join(" → ");
}

export function montarBlocoLinhaClassificacao(
  input: LinhaClassificacaoInput,
  fase: "N2" | "N3"
): string {
  const linhas: string[] = ["=== LINHA DE CLASSIFICAÇÃO (já definida — não alterar nesta fase) ==="];

  if (input.n1) {
    linhas.push(formatarSegmentoN1(input.n1));
  }
  if (fase === "N3" && input.escopoN2Id?.trim()) {
    linhas.push(formatarSegmentoN2(input.escopoN2Id.trim()));
  }

  if (linhas.length === 1) return "";

  if (fase === "N2") {
    linhas.push(
      "→ Nesta fase: escolha o escopo N2 no catálogo acima. Não altere N1."
    );
  } else {
    linhas.push(
      "→ Nesta fase: descreva só o conhecimento exigido (N3), coerente com N1 e N2."
    );
  }

  return `${linhas.join("\n")}\n\n`;
}
