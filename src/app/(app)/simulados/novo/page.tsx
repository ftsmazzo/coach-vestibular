"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Card, Input, Label } from "@/components/ui";
import { parseListaErros } from "@/lib/gabarito";
import { formatProvaLabel } from "@/lib/prova-label";

interface ProvaOption {
  id: string;
  nome: string;
  banca: string;
  ano?: number | null;
  caderno?: string | null;
  totalQuestoes: number;
  gabaritoCompleto: boolean;
  questoesCount: number;
}

export default function NovoSimuladoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const provaIdInicial = searchParams.get("provaId") ?? "";
  const [provas, setProvas] = useState<ProvaOption[]>([]);
  const [provaId, setProvaId] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [checkIn, setCheckIn] = useState<number | null>(null);
  const [gabaritoAluno, setGabaritoAluno] = useState("");
  const [respostas, setRespostas] = useState("");
  const [listaErros, setListaErros] = useState("");
  const [modo, setModo] = useState<"gabarito" | "sequencia" | "erros">("gabarito");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/provas")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setProvas(data);
          const pre = provaIdInicial && data.some((p: ProvaOption) => p.id === provaIdInicial)
            ? provaIdInicial
            : data[0]?.id ?? "";
          setProvaId(pre);
        }
      });
  }, [provaIdInicial]);

  const prova = provas.find((p) => p.id === provaId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!provaId) {
      setError("Selecione uma prova cadastrada pelo admin.");
      return;
    }
    setLoading(true);
    setError("");

    const body: Record<string, unknown> = {
      provaId,
      data,
    };
    if (checkIn != null) body.checkInScore = checkIn;

    if (modo === "gabarito") {
      if (gabaritoAluno.trim().split(/\n/).filter(Boolean).length < 1) {
        setError("Informe ao menos uma linha no formato número,letra (ex.: 1,C).");
        setLoading(false);
        return;
      }
      body.gabaritoAluno = gabaritoAluno;
    } else if (modo === "sequencia") {
      if (respostas.replace(/[^A-E]/gi, "").length < 3) {
        setError("Cole suas respostas (sequência de letras A–E).");
        setLoading(false);
        return;
      }
      body.respostas = respostas;
    } else {
      const erros = parseListaErros(listaErros);
      if (erros.length === 0) {
        setError("Informe pelo menos um número de questão errada.");
        setLoading(false);
        return;
      }
      body.apenasErros = erros;
    }

    const res = await fetch("/api/exams/from-prova", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const dataRes = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(dataRes.error ?? "Erro ao salvar");
      return;
    }
    router.push(`/simulados/${dataRes.exam.id}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/provas" className="text-sm text-teal-700 hover:underline">
          ← Voltar às provas públicas
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Registrar resultado</h1>
        <p className="mt-1 text-slate-600">
          Seu gabarito (o que você marcou em cada questão) é salvo como o oficial do admin. Com os
          dois, o sistema confere acerto/erro por questão e monta o diagnóstico nos conteúdos da
          prova.
        </p>
      </div>

      {provas.length === 0 ? (
        <Card>
          <p className="text-slate-600">
            Nenhuma prova publicada ainda. O admin cadastra em{" "}
            <strong>Admin → Banco de provas</strong> e publica.{" "}
            <Link href="/provas" className="text-teal-700 underline">
              Ver catálogo
            </Link>
          </p>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <Label>Qual prova você fez?</Label>
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              value={provaId}
              onChange={(e) => setProvaId(e.target.value)}
            >
              {provas.map((p) => (
                <option key={p.id} value={p.id}>
                  {formatProvaLabel(p)} — {p.questoesCount}/{p.totalQuestoes} no banco
                  {p.gabaritoCompleto ? "" : " (gabarito parcial)"}
                </option>
              ))}
            </select>
            {prova && (
              <p className="mt-2 text-xs text-slate-500">
                {prova.banca} · {prova.questoesCount} de {prova.totalQuestoes} questões
                classificadas no banco
              </p>
            )}
          </Card>

          <Card className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Como você se sentiu depois da prova? (opcional)</Label>
              <p className="mt-1 text-xs text-slate-500">
                1 = muito pesado · 5 = tranquilo. Notas 1–2 ou muitos erros deixam o{" "}
                <strong>plano da semana mais leve</strong> (modo recuperação). Não é terapia —
                só ajusta a carga de estudo.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCheckIn(n)}
                    className={`h-9 w-9 rounded-full text-sm ${
                      checkIn === n ? "bg-teal-600 text-white" : "bg-slate-100"
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCheckIn(null)}
                  className={`rounded-lg px-3 py-1.5 text-sm ${
                    checkIn === null ? "bg-slate-200 font-medium" : "text-slate-500"
                  }`}
                >
                  Pular
                </button>
              </div>
            </div>
          </Card>

          <Card>
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setModo("gabarito")}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  modo === "gabarito" ? "bg-teal-600 text-white" : "bg-slate-100"
                }`}
              >
                Meu gabarito (recomendado)
              </button>
              <button
                type="button"
                onClick={() => setModo("sequencia")}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  modo === "sequencia" ? "bg-teal-600 text-white" : "bg-slate-100"
                }`}
              >
                Sequência A–E
              </button>
              <button
                type="button"
                onClick={() => setModo("erros")}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  modo === "erros" ? "bg-teal-600 text-white" : "bg-slate-100"
                }`}
              >
                Só os erros
              </button>
            </div>

            {modo === "gabarito" ? (
              <div>
                <Label>Seu gabarito — uma linha por questão</Label>
                <textarea
                  className="mt-1 w-full rounded-xl border p-3 font-mono text-sm"
                  rows={8}
                  placeholder={"1,C\n2,A\n3,B\n4,D"}
                  value={gabaritoAluno}
                  onChange={(e) => setGabaritoAluno(e.target.value)}
                />
                <p className="mt-2 text-xs text-slate-500">
                  Mesmo formato do admin (número + letra). Gravamos sua marcação em cada questão e
                  comparamos com o gabarito oficial da prova, quando existir. Os erros entram no
                  diagnóstico com matéria e assunto do banco.
                </p>
                {prova && !prova.gabaritoCompleto && (
                  <p className="mt-2 text-xs text-amber-700">
                    Gabarito oficial ainda incompleto nesta prova — o percentual de acertos pode ficar
                    limitado até o admin publicar o oficial.
                  </p>
                )}
              </div>
            ) : modo === "sequencia" ? (
              <div>
                <Label>
                  Suas respostas em sequência ({prova?.totalQuestoes ?? 60} questões, ordem 1…N)
                </Label>
                <textarea
                  className="mt-1 w-full rounded-xl border p-3 font-mono text-sm"
                  rows={4}
                  placeholder="CABDE..."
                  value={respostas}
                  onChange={(e) => setRespostas(e.target.value)}
                />
                <p className="mt-2 text-xs text-slate-500">
                  Use se tiver a folha em sequência contínua. Prefira «Meu gabarito» se os números
                  das questões não forem contínuos.
                </p>
              </div>
            ) : (
              <div>
                <Label>Questões erradas (análise parcial)</Label>
                <textarea
                  className="mt-1 w-full rounded-xl border p-3 text-sm"
                  rows={3}
                  placeholder="3, 8, 12-15, 40"
                  value={listaErros}
                  onChange={(e) => setListaErros(e.target.value)}
                />
                <p className="mt-2 text-xs text-amber-700">
                  Não grava o que você marcou (A–E) — só quais números errou. Para análise completa
                  de acertos e erros, use «Meu gabarito».
                </p>
              </div>
            )}
          </Card>

          {error && <p className="text-sm text-rose-600">{error}</p>}
          <Button type="submit" disabled={loading}>
            {loading ? "Analisando..." : "Gerar diagnóstico e plano"}
          </Button>
        </form>
      )}
    </div>
  );
}
