import { extrairTrechosPorNumero } from "./prova-texto-parse";

export interface QuestaoAuditoriaInput {
  numero: number;
  materia: string;
  assunto: string;
  conhecimentoExigido?: string | null;
  nivelDificuldade?: string | null;
  areaBloco?: string | null;
  observacoes?: string | null;
  enunciado?: string | null;
}

export interface ClassificacaoResumo {
  materia: string;
  assunto: string;
  conhecimentoExigido?: string | null;
  nivelDificuldade?: string | null;
  areaBloco?: string | null;
}

export interface AlertaAuditoria {
  numero: number;
  severidade: "alta" | "media";
  motivos: string[];
  atual: ClassificacaoResumo;
  vizinhoAnterior?: { numero: number; classificacao: ClassificacaoResumo };
  vizinhoPosterior?: { numero: number; classificacao: ClassificacaoResumo };
  /** Questão distante com mesma classificação (ex.: 29 igual à 21) */
  parRemoto?: { numero: number; classificacao: ClassificacaoResumo };
  enunciado?: string;
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function chave(q: Pick<QuestaoAuditoriaInput, "materia" | "assunto">): string {
  return `${norm(q.materia)}|${norm(q.assunto)}`;
}

function resumo(q: QuestaoAuditoriaInput): ClassificacaoResumo {
  return {
    materia: q.materia,
    assunto: q.assunto,
    conhecimentoExigido: q.conhecimentoExigido,
    nivelDificuldade: q.nivelDificuldade,
    areaBloco: q.areaBloco,
  };
}

export function auditarClassificacaoQuestoes(
  questoes: QuestaoAuditoriaInput[],
  textoFonte?: string | null
): AlertaAuditoria[] {
  const sorted = [...questoes].sort((a, b) => a.numero - b.numero);
  const alertas: AlertaAuditoria[] = [];

  let trechos = new Map<number, string>();
  if (textoFonte?.trim()) {
    trechos = extrairTrechosPorNumero(textoFonte);
  }

  for (let i = 0; i < sorted.length; i++) {
    const q = sorted[i];
    const motivos: string[] = [];
    const prev = sorted[i - 1];
    const next = sorted[i + 1];
    const qKey = chave(q);

    if (q.materia === "A classificar" || q.assunto === "A classificar") {
      motivos.push("Matéria ou assunto ainda «A classificar».");
    }

    if (prev && next) {
      const pk = chave(prev);
      const nk = chave(next);
      if (pk === nk && qKey !== pk) {
        motivos.push(
          `Questões ${prev.numero} e ${next.numero} têm a mesma classificação (${prev.materia} — ${prev.assunto}), mas esta difere — comum após quebra de página na IA.`
        );
      }
      if (norm(prev.materia) === norm(next.materia) && norm(prev.materia) !== norm(q.materia)) {
        motivos.push(
          `Vizinhos ${prev.numero} e ${next.numero} são ${prev.materia}; esta está em ${q.materia}.`
        );
      }
    }

    let parRemoto: AlertaAuditoria["parRemoto"];
    for (const other of sorted) {
      if (other.numero === q.numero) continue;
      const dist = Math.abs(other.numero - q.numero);
      if (dist < 3 || dist > 15) continue;
      if (chave(other) !== qKey) continue;
      if (prev && chave(prev) === qKey) continue;
      parRemoto = { numero: other.numero, classificacao: resumo(other) };
      motivos.push(
        `Mesma classificação da questão ${other.numero} (${other.materia} — ${other.assunto}), mas diferente dos vizinhos ${prev?.numero ?? "—"} / ${next?.numero ?? "—"}.`
      );
      break;
    }

    if (
      prev?.areaBloco &&
      next?.areaBloco &&
      norm(prev.areaBloco) === norm(next.areaBloco) &&
      q.areaBloco &&
      norm(q.areaBloco) !== norm(prev.areaBloco)
    ) {
      motivos.push(`Bloco da prova diferente dos vizinhos (${q.areaBloco} vs ${prev.areaBloco}).`);
    }

    if (motivos.length === 0) continue;

    const enunciado =
      q.enunciado?.trim() ||
      trechos.get(q.numero) ||
      undefined;

    alertas.push({
      numero: q.numero,
      severidade: motivos.some((m) => m.includes("quebra") || m.includes("Mesma classificação"))
        ? "alta"
        : "media",
      motivos,
      atual: resumo(q),
      vizinhoAnterior: prev
        ? { numero: prev.numero, classificacao: resumo(prev) }
        : undefined,
      vizinhoPosterior: next
        ? { numero: next.numero, classificacao: resumo(next) }
        : undefined,
      parRemoto,
      enunciado,
    });
  }

  return alertas.sort((a, b) => {
    if (a.severidade !== b.severidade) return a.severidade === "alta" ? -1 : 1;
    return a.numero - b.numero;
  });
}

function escCsv(val: string): string {
  const v = val.replace(/"/g, '""').replace(/\r?\n/g, " ");
  return v.includes(",") || v.includes('"') ? `"${v}"` : v;
}

/** Texto para colar no ChatGPT / planilha e corrigir matéria, assunto e conhecimento. */
export function formatarExportacaoAuditoria(
  provaNome: string,
  alertas: AlertaAuditoria[]
): { texto: string; csv: string; numeros: number[] } {
  const linhas: string[] = [
    `=== AUDITORIA DE CLASSIFICAÇÃO — ${provaNome} ===`,
    `${alertas.length} questão(ões) suspeita(s). Revise matéria, assunto e conhecimento exigido.`,
    `Depois importe o CSV corrigido em Admin → Banco de provas → Importar CSV com «Só atualizar questões do CSV» marcado.`,
    "",
  ];

  for (const a of alertas) {
    linhas.push(`--- Questão ${a.numero} [${a.severidade.toUpperCase()}] ---`);
    for (const mot of a.motivos) linhas.push(`• ${mot}`);
    linhas.push("");
    linhas.push("Classificação ATUAL no banco:");
    linhas.push(`  materia: ${a.atual.materia}`);
    linhas.push(`  assunto: ${a.atual.assunto}`);
    if (a.atual.conhecimentoExigido)
      linhas.push(`  conhecimento: ${a.atual.conhecimentoExigido}`);
    if (a.atual.nivelDificuldade) linhas.push(`  dificuldade: ${a.atual.nivelDificuldade}`);
    if (a.vizinhoAnterior) {
      linhas.push(
        `  vizinho anterior (q.${a.vizinhoAnterior.numero}): ${a.vizinhoAnterior.classificacao.materia} — ${a.vizinhoAnterior.classificacao.assunto}`
      );
    }
    if (a.vizinhoPosterior) {
      linhas.push(
        `  vizinho posterior (q.${a.vizinhoPosterior.numero}): ${a.vizinhoPosterior.classificacao.materia} — ${a.vizinhoPosterior.classificacao.assunto}`
      );
    }
    if (a.parRemoto) {
      linhas.push(
        `  SUGESTÃO (mesmo padrão da q.${a.parRemoto.numero}): ${a.parRemoto.classificacao.materia} — ${a.parRemoto.classificacao.assunto}`
      );
    }
    linhas.push("");
    if (a.enunciado) {
      linhas.push("TEXTO DA QUESTÃO (copiar/colar do PDF):");
      linhas.push(a.enunciado);
    } else {
      linhas.push(
        "(Sem trecho de enunciado — cole o texto da questão no CSV ou reextraia com texto da prova salvo.)"
      );
    }
    linhas.push("");
    linhas.push("---");
    linhas.push("");
  }

  const header =
    "numero,materia,assunto,conhecimentoExigido,nivelDificuldade,enunciado,motivo_auditoria";
  const csvRows = alertas.map((a) => {
    const mot = a.motivos.join(" | ");
    const enun = (a.enunciado ?? "").slice(0, 500);
    return [
      a.numero,
      escCsv(a.atual.materia),
      escCsv(a.atual.assunto),
      escCsv(a.atual.conhecimentoExigido ?? ""),
      escCsv(a.atual.nivelDificuldade ?? ""),
      escCsv(enun),
      escCsv(mot),
    ].join(",");
  });

  return {
    texto: linhas.join("\n"),
    csv: [header, ...csvRows].join("\n"),
    numeros: alertas.map((a) => a.numero),
  };
}
