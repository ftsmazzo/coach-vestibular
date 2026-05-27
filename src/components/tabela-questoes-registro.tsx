"use client";

import { SugerirClassificacao } from "@/components/sugerir-classificacao";

export type LinhaQuestaoRegistro = {
  numero: number;
  respostaAluno: string | null;
  gabarito: string | null;
  materia: string;
  assunto: string;
  conhecimento: string | null;
  nivelDificuldade: string | null;
  correto: boolean;
  podeSugerir: boolean;
};

export function TabelaQuestoesRegistro({
  examId,
  linhas,
}: {
  examId: string;
  linhas: LinhaQuestaoRegistro[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b text-slate-500">
            <th className="p-2">#</th>
            <th className="p-2">Sua resposta</th>
            <th className="p-2">Gabarito oficial</th>
            <th className="p-2">Matéria / Assunto</th>
            <th className="p-2">Conhecimento</th>
            <th className="p-2 text-right">Resultado</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((q) => (
            <tr
              key={q.numero}
              className={`border-b border-slate-100 ${
                q.correto ? "bg-emerald-50/50" : "bg-rose-50/50"
              }`}
            >
              <td className="p-2 align-top font-medium">{q.numero}</td>
              <td className="p-2 align-top font-mono">{q.respostaAluno ?? "—"}</td>
              <td className="p-2 align-top font-mono">{q.gabarito ?? "—"}</td>
              <td className="p-2 align-top text-slate-700">
                <div>
                  {q.materia} / {q.assunto}
                </div>
                {q.podeSugerir && (
                  <SugerirClassificacao
                    examId={examId}
                    numero={q.numero}
                    materiaAtual={q.materia}
                    assuntoAtual={q.assunto}
                  />
                )}
              </td>
              <td
                className="max-w-[200px] truncate p-2 align-top text-xs text-slate-500"
                title={q.conhecimento ?? ""}
              >
                {q.conhecimento ?? "—"}
                {q.nivelDificuldade ? ` · ${q.nivelDificuldade}` : ""}
              </td>
              <td className="p-2 align-top text-right">{q.correto ? "✓" : "✗"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
