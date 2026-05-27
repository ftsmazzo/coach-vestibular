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

function CardQuestao({
  examId,
  q,
}: {
  examId: string;
  q: LinhaQuestaoRegistro;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        q.correto ? "border-emerald-200 bg-emerald-50/60" : "border-rose-200 bg-rose-50/60"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-sm font-bold text-slate-800 ring-1 ring-slate-200">
          {q.numero}
        </span>
        <span
          className={`text-sm font-semibold ${q.correto ? "text-emerald-700" : "text-rose-700"}`}
        >
          {q.correto ? "✓ Acerto" : "✗ Erro"}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-[10px] font-medium uppercase text-slate-500">Sua resposta</p>
          <p className="font-mono font-medium">{q.respostaAluno ?? "—"}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase text-slate-500">Gabarito</p>
          <p className="font-mono font-medium">{q.gabarito ?? "—"}</p>
        </div>
      </div>
      <p className="mt-2 text-sm text-slate-800">
        <span className="font-medium">{q.materia}</span>
        <span className="text-slate-500"> · {q.assunto}</span>
      </p>
      {(q.conhecimento || q.nivelDificuldade) && (
        <p className="mt-1 text-xs text-slate-500 line-clamp-2">
          {q.conhecimento ?? ""}
          {q.nivelDificuldade ? ` · ${q.nivelDificuldade}` : ""}
        </p>
      )}
      {q.podeSugerir && (
        <div className="mt-2">
          <SugerirClassificacao
            examId={examId}
            numero={q.numero}
            materiaAtual={q.materia}
            assuntoAtual={q.assunto}
          />
        </div>
      )}
    </div>
  );
}

export function TabelaQuestoesRegistro({
  examId,
  linhas,
}: {
  examId: string;
  linhas: LinhaQuestaoRegistro[];
}) {
  return (
    <>
      <div className="space-y-2 md:hidden">
        {linhas.map((q) => (
          <CardQuestao key={q.numero} examId={examId} q={q} />
        ))}
      </div>

      <div className="hidden md:block">
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-slate-500">
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
      </div>
    </>
  );
}
