"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Button, Badge } from "@/components/ui";

const ALTERNATIVAS = ["A", "B", "C", "D", "E"];

type QuizItem = {
  provaQuestaoId: string;
  provaNome: string;
  numero: number;
  materia: string;
  assunto: string;
  enunciado: string | null;
};

type QuizState = {
  quizId: string | null;
  itens: QuizItem[];
  metaTitulo: string | null;
  insuficiente: boolean;
};

export default function FecharCicloPage() {
  const router = useRouter();
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ pctAcerto: number; acertos: number; total: number } | null>(null);
  const [fechado, setFechado] = useState<{ mensagem: string } | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/ciclo/quiz", { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (res.ok) setQuiz(data);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function corrigir() {
    if (!quiz?.quizId) return;
    setEnviando(true);
    const res = await fetch("/api/ciclo/quiz/responder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quizId: quiz.quizId, respostas }),
    });
    const data = await res.json();
    setEnviando(false);
    if (res.ok) setResultado(data);
  }

  async function fechar(quizPct: number | null) {
    setEnviando(true);
    const res = await fetch("/api/ciclo/fechar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quizPct }),
    });
    const data = await res.json();
    setEnviando(false);
    if (res.ok) {
      setFechado({ mensagem: data.mensagem });
      router.refresh();
    }
  }

  const respondidas = Object.keys(respostas).length;
  const total = quiz?.itens.length ?? 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/quests" className="text-sm text-teal-700 hover:underline">
          ← Voltar
        </Link>
        <h1 className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">Fechar ciclo</h1>
        <p className="mt-1 text-sm text-slate-600">
          Um mini-quiz rápido no foco do ciclo{quiz?.metaTitulo ? ` (${quiz.metaTitulo})` : ""} para
          medir se avançou. Depois você confirma com uma prova real.
        </p>
      </div>

      {fechado ? (
        <Card className="border-teal-200 bg-teal-50">
          <p className="text-sm text-teal-900">{fechado.mensagem}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => router.push("/quests")}>Ver novo ciclo</Button>
            <Link href="/provas" className="self-center text-sm font-medium text-teal-700 underline">
              Registrar uma prova real
            </Link>
          </div>
        </Card>
      ) : loading ? (
        <p className="text-slate-500">Carregando…</p>
      ) : quiz?.insuficiente || !quiz?.quizId ? (
        <Card className="border-amber-200 bg-amber-50/60">
          <p className="text-sm text-amber-950">
            Ainda não há questões suficientes no banco para o mini-quiz deste foco. Sem problema —
            feche o ciclo e <strong>confirme seu avanço registrando uma prova ou simulado</strong> do
            catálogo.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button disabled={enviando} onClick={() => fechar(null)}>
              Fechar ciclo
            </Button>
            <Link href="/provas" className="self-center text-sm font-medium text-teal-700 underline">
              Ir para Atividades
            </Link>
          </div>
        </Card>
      ) : resultado ? (
        <ResultadoCiclo
          resultado={resultado}
          enviando={enviando}
          onFechar={() => fechar(resultado.pctAcerto)}
        />
      ) : (
        <>
          <p className="text-xs text-slate-500">
            {respondidas}/{total} respondidas. Se não lembrar a questão, abra o caderno da prova
            indicada.
          </p>
          <ul className="space-y-3">
            {quiz.itens.map((it, i) => (
              <li key={it.provaQuestaoId}>
                <Card>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <Badge tone="neutral">{it.materia}</Badge>
                    <span className="text-xs text-slate-500">
                      {it.provaNome} · questão {it.numero}
                    </span>
                  </div>
                  {it.enunciado ? (
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700 line-clamp-6">
                      {it.enunciado}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">
                      {it.assunto} — abra a questão {it.numero} de {it.provaNome} no caderno.
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ALTERNATIVAS.map((alt) => (
                      <button
                        key={alt}
                        type="button"
                        onClick={() =>
                          setRespostas((r) => ({ ...r, [it.provaQuestaoId]: alt }))
                        }
                        className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-semibold ${
                          respostas[it.provaQuestaoId] === alt
                            ? "border-teal-500 bg-teal-600 text-white"
                            : "border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {alt}
                      </button>
                    ))}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
          <Button
            onClick={corrigir}
            disabled={enviando || respondidas === 0}
            className="w-full sm:w-auto"
          >
            {enviando ? "Corrigindo…" : "Corrigir mini-quiz"}
          </Button>
        </>
      )}
    </div>
  );
}

function ResultadoCiclo({
  resultado,
  enviando,
  onFechar,
}: {
  resultado: { pctAcerto: number; acertos: number; total: number };
  enviando: boolean;
  onFechar: () => void;
}) {
  const bom = resultado.pctAcerto >= 60;
  return (
    <Card className={bom ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50"}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Resultado do mini-quiz
      </p>
      <p className="mt-1 text-3xl font-bold text-slate-900">{resultado.pctAcerto}%</p>
      <p className="text-sm text-slate-600">
        {resultado.acertos} de {resultado.total} no foco do ciclo.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-slate-700">
        {bom
          ? "Bom sinal! Para confirmar de verdade, registre uma prova ou simulado real do catálogo nesse tema."
          : "Ainda há espaço — isso é um sinal parcial. Vale repetir o foco no próximo ciclo e confirmar com uma prova real."}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={enviando} onClick={onFechar}>
          {enviando ? "Fechando…" : "Fechar ciclo e abrir o próximo"}
        </Button>
        <Link href="/provas" className="self-center text-sm font-medium text-teal-700 underline">
          Registrar prova real
        </Link>
      </div>
    </Card>
  );
}
