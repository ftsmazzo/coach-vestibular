import type { ProvaQuestaoRow } from "@/lib/parse-prova-csv";
import { normalizarAreaBloco } from "@/lib/areas-bloco";
import { areaBlocoPorNumero } from "@/lib/prova-classificacao-regras";
import type { EstruturaProvaDetectada } from "@/lib/prova-pipeline-contexto";

export type N8nQuestaoExtraida = {
  indice_global?: number | null;
  numero: number;
  secao?: string | null;
  opcao_lingua_estrangeira?: string | null;
  enunciado?: string | null;
  alternativas?: Record<string, string> | string | null;
  texto_base_anterior?: string | null;
  valido?: boolean;
  precisa_revisao_imagem?: boolean;
};

function blocoTituloParaArea(titulo: string): string | null {
  return normalizarAreaBloco(titulo) ?? null;
}

export function areaBlocoPorOrdemFisica(
  blocos: Array<{ titulo: string; ordem_inicio: number; ordem_fim: number }>,
  ordem: number
): string | null {
  for (const b of blocos) {
    if (ordem >= b.ordem_inicio && ordem <= b.ordem_fim) {
      return blocoTituloParaArea(b.titulo);
    }
  }
  return null;
}

export function atribuirAreaBlocoNasRows(
  rows: ProvaQuestaoRow[],
  estrutura?: Pick<EstruturaProvaDetectada, "blocos"> | null
): { rows: ProvaQuestaoRow[]; avisos: string[] } {
  const blocos = estrutura?.blocos ?? [];
  if (blocos.length === 0) {
    return { rows, avisos: [] };
  }

  const avisos: string[] = [];
  let atribuidas = 0;

  const out = rows.map((r) => {
    if (r.areaBloco?.trim()) return r;

    const ordem = r.ordemExtracao ?? 0;
    const porOrdem = ordem > 0 ? areaBlocoPorOrdemFisica(blocos, ordem) : null;
    const porNumero = areaBlocoPorNumero(blocos, r.numero);
    const area = porOrdem ?? porNumero ?? null;

    if (!area) return r;
    atribuidas++;
    return { ...r, areaBloco: area };
  });

  if (atribuidas > 0) {
    avisos.push(`${atribuidas} questão(ões) receberam área/bloco da estrutura detectada no PDF.`);
  }

  return { rows: out, avisos };
}

export function secaoN8nParaAreaBloco(secao: string | null | undefined): string | null {
  if (!secao?.trim()) return null;
  return normalizarAreaBloco(secao) ?? null;
}

export function opcaoLinguaN8nParaVariante(
  opcao: string | null | undefined
): "COMUM" | "INGLES" | "ESPANHOL" {
  const o = String(opcao ?? "").toLowerCase();
  if (o.includes("ingles") || o === "en") return "INGLES";
  if (o.includes("espanhol") || o === "es") return "ESPANHOL";
  return "COMUM";
}

function alternativasN8nParaTexto(
  alt: Record<string, string> | string | null | undefined
): string | undefined {
  if (!alt) return undefined;
  if (typeof alt === "string") return alt.trim() || undefined;
  const linhas = Object.entries(alt)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `(${k}) ${String(v).trim()}`)
    .filter((l) => l.length > 4);
  return linhas.length ? linhas.join("\n") : undefined;
}

function repararEnunciadoN8n(en: string): string {
  return en
    .replace(/^ª\s+figura\b/i, "A figura")
    .replace(/^º\s+diagrama\b/i, "O diagrama");
}

function montarEnunciadoN8n(item: N8nQuestaoExtraida): string | undefined {
  const base = item.texto_base_anterior?.trim();
  const en = item.enunciado?.trim();
  const enReparado = en ? repararEnunciadoN8n(en) : en;
  if (base && enReparado) return `${base}\n\n${enReparado}`;
  return enReparado || base || undefined;
}

function contagemAlternativasN8n(
  alt: Record<string, string> | string | null | undefined
): number {
  if (!alt) return 0;
  if (typeof alt === "string") {
    return (alt.match(/\([A-E]\)/g) ?? []).length;
  }
  return Object.keys(alt).filter((k) => /^[A-E]$/i.test(k)).length;
}

/** Descarta fragmentos típicos de falso positivo do parser n8n (ordinais soltos, continuação de enunciado). */
export function itemN8nEspurio(item: N8nQuestaoExtraida): boolean {
  const en = repararEnunciadoN8n(item.enunciado?.trim() ?? "");
  if (!en) return true;

  const nAlts = contagemAlternativasN8n(item.alternativas);
  const temBase = Boolean(item.texto_base_anterior?.trim());

  if (nAlts >= 4) {
    if (!temBase && /^[a-zà-ÿ]/.test(en) && en.length < 45 && !/\?/.test(en)) {
      return true;
    }
    return false;
  }

  if (/^\d{0,2}[ªº°]\s/.test(en)) return true;
  if (/^[ªº°]\s/.test(en)) return true;
  if (/^[éa]\s+x\s+cm/i.test(en)) return true;
  if (/^logaritmo\s+de\s+x/i.test(en)) return true;
  if (en.length < 25 && !temBase) return true;

  return false;
}

export function n8nItensParaRows(itens: N8nQuestaoExtraida[]): ProvaQuestaoRow[] {
  const validos = itens.filter(
    (i) => i.valido !== false && i.numero > 0 && !itemN8nEspurio(i)
  );
  const sorted = [...validos].sort(
    (a, b) => (a.indice_global ?? a.numero) - (b.indice_global ?? b.numero)
  );

  return sorted.map((item, idx) => {
    const ordem = idx + 1;
    const enunciado = montarEnunciadoN8n(item);
    const area =
      secaoN8nParaAreaBloco(item.secao) ??
      (opcaoLinguaN8nParaVariante(item.opcao_lingua_estrangeira) !== "COMUM"
        ? normalizarAreaBloco("Língua estrangeira moderna – Inglês")
        : null);

    return {
      ordemExtracao: ordem,
      numero: item.numero,
      idiomaVariante: opcaoLinguaN8nParaVariante(item.opcao_lingua_estrangeira),
      areaBloco: area ?? undefined,
      materia: "A classificar",
      assunto: "A classificar",
      enunciado,
      alternativas: alternativasN8nParaTexto(item.alternativas),
    };
  });
}
