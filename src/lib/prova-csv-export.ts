import type { ProvaQuestaoRow } from "@/lib/parse-prova-csv";
import { compararPorOrdemExtracao } from "@/lib/prova-questao-ordem";

function escCsv(val: string | undefined | null): string {
  const s = (val ?? "").replace(/"/g, '""');
  if (/[",\n\r;]/.test(s)) return `"${s}"`;
  return s;
}

/** Gera CSV no formato aceito pelo importador admin (mesmas colunas do agente GPT). */
export function gerarCsvProvaQuestoes(rows: ProvaQuestaoRow[]): string {
  const header = [
    "Número da Questão",
    "Área/Bloco",
    "Matéria",
    "Assunto",
    "Conhecimento",
    "Dificuldade",
    "Observações",
    "Enunciado",
    "Gabarito",
  ];
  const lines = [header.join(",")];
  const sorted = [...rows].sort(compararPorOrdemExtracao);
  for (const r of sorted) {
    lines.push(
      [
        String(r.numero),
        escCsv(r.areaBloco),
        escCsv(r.materia),
        escCsv(r.assunto),
        escCsv(r.conhecimentoExigido),
        escCsv(r.nivelDificuldade),
        escCsv(r.observacoes),
        escCsv(r.enunciado),
        escCsv(r.gabarito),
      ].join(",")
    );
  }
  return lines.join("\n");
}
