import { extrairTrechosPorNumero } from "./prova-texto-parse";
import {
  normalizarMateria,
  textoIndicaIngles,
  textoIndicaPortugues,
} from "./prova-materia-ajuste";

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
  parRemoto?: { numero: number; classificacao: ClassificacaoResumo };
  enunciado?: string;
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Chave estrita: matéria + assunto (detecta cópia errada da IA). */
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
    const qMat = normalizarMateria(q.materia);

    if (q.materia === "A classificar" || q.assunto === "A classificar") {
      motivos.push("Matéria ou assunto ainda «A classificar».");
    }

    const textoQ =
      q.enunciado?.trim() || trechos.get(q.numero) || "";
    if (textoQ.length >= 60) {
      if (textoIndicaIngles(textoQ) && qMat === "portugues") {
        motivos.push(
          "O texto-base está em inglês, mas a matéria no banco é Português — cole o enunciado abaixo e clique em Reclassificar."
        );
      }
      if (textoIndicaPortugues(textoQ) && qMat === "espanhol") {
        motivos.push(
          "O texto-base está em português, mas a matéria no banco é Espanhol — cole o enunciado abaixo e clique em Reclassificar."
        );
      }
    } else if (qMat === "portugues" && textoQ.length < 60) {
      const assuntoSoInterpretacao =
        /^interpreta[cç][aã]o de texto\.?$/i.test(q.assunto.trim()) ||
        (norm(q.assunto) === "interpretação de texto" ||
          norm(q.assunto) === "interpretacao de texto");
      const vizinhoIngles =
        (prev && normalizarMateria(prev.materia) === "ingles") ||
        (next && normalizarMateria(next.materia) === "ingles");
      if (assuntoSoInterpretacao || vizinhoIngles) {
        motivos.push(
          "Classificada como Português com assunto genérico — se o texto-base for em inglês, cole o enunciado e reclassifique."
        );
      }
    }

    if (prev && next) {
      const pk = chave(prev);
      const nk = chave(next);
      const prevMat = normalizarMateria(prev.materia);
      const nextMat = normalizarMateria(next.materia);

      if (pk === nk && qKey !== pk) {
        const mesmaDisciplina =
          prevMat === qMat && nextMat === qMat && prevMat === nextMat;
        if (!mesmaDisciplina) {
          motivos.push(
            `Questões ${prev.numero} e ${next.numero} têm a mesma classificação (${prev.materia} — ${prev.assunto}), mas esta difere — comum após quebra de página na IA.`
          );
        }
      }
    }

    let parRemoto: AlertaAuditoria["parRemoto"];
    for (const other of sorted) {
      if (other.numero === q.numero) continue;
      const dist = Math.abs(other.numero - q.numero);
      if (dist < 5 || dist > 15) continue;
      if (chave(other) !== qKey) continue;
      if (prev && chave(prev) === qKey) continue;
      if (next && chave(next) === qKey) continue;
      const prevMat = prev ? normalizarMateria(prev.materia) : "";
      const nextMat = next ? normalizarMateria(next.materia) : "";
      if (prevMat === qMat || nextMat === qMat) continue;
      parRemoto = { numero: other.numero, classificacao: resumo(other) };
      motivos.push(
        `Classificação idêntica à questão ${other.numero}, mas vizinhos ${prev?.numero ?? "—"} e ${next?.numero ?? "—"} são de outra matéria — possível erro de quebra de página.`
      );
      break;
    }

    if (motivos.length === 0) continue;

    const enunciado =
      q.enunciado?.trim() ||
      trechos.get(q.numero) ||
      undefined;

    alertas.push({
      numero: q.numero,
      severidade: motivos.some((m) => m.includes("quebra") || m.includes("possível erro"))
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

export function formatarExportacaoAuditoria(
  provaNome: string,
  alertas: AlertaAuditoria[]
): { texto: string; csv: string; numeros: number[] } {
  const linhas: string[] = [
    `=== AUDITORIA — ${provaNome} ===`,
    `${alertas.length} questão(ões) suspeita(s).`,
    "",
  ];

  for (const a of alertas) {
    linhas.push(`--- Questão ${a.numero} [${a.severidade.toUpperCase()}] ---`);
    for (const mot of a.motivos) linhas.push(`• ${mot}`);
    linhas.push("");
    linhas.push(`  materia: ${a.atual.materia}`);
    linhas.push(`  assunto: ${a.atual.assunto}`);
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
