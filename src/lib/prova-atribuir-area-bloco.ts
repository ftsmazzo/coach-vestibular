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

export function n8nItensParaRows(itens: N8nQuestaoExtraida[]): ProvaQuestaoRow[] {
  const validos = itens.filter((i) => i.valido !== false && i.numero > 0);
  const sorted = [...validos].sort(
    (a, b) => (a.indice_global ?? a.numero) - (b.indice_global ?? b.numero)
  );

  return sorted.map((item, idx) => {
    const ordem = item.indice_global && item.indice_global > 0 ? item.indice_global : idx + 1;
    const area =
      secaoN8nParaAreaBloco(item.secao) ??
      (opcaoLinguaN8nParaVariante(item.opcao_lingua_estrangeira) !== "COMUM"
        ? normalizarAreaBloco("Língua estrangeira moderna – Inglês")
        : null);

    let observacoes: string | undefined;
    if (item.texto_base_anterior?.trim()) {
      observacoes = `[texto-base compartilhado]\n${item.texto_base_anterior.trim().slice(0, 500)}`;
    }

    return {
      ordemExtracao: ordem,
      numero: item.numero,
      idiomaVariante: opcaoLinguaN8nParaVariante(item.opcao_lingua_estrangeira),
      areaBloco: area ?? undefined,
      materia: "A classificar",
      assunto: "A classificar",
      enunciado: item.enunciado?.trim() || undefined,
      alternativas: alternativasN8nParaTexto(item.alternativas),
      observacoes,
    };
  });
}
