"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Input, Label, Textarea } from "@/components/ui";
import { MAX_QUESTOES_LISTA } from "@/lib/lista-exercicios";
import { parseListaErros } from "@/lib/gabarito";

export default function NovaListaPage() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [data, setData] = useState("");
  const [totalQuestoes, setTotalQuestoes] = useState(20);
  const [listaErros, setListaErros] = useState("");
  const [checkIn, setCheckIn] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const apenasErros = parseListaErros(listaErros);
    const res = await fetch("/api/listas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome,
        data,
        totalQuestoes,
        apenasErros,
        checkInScore: checkIn ?? undefined,
      }),
    });
    const dataRes = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(dataRes.error ?? "Erro ao salvar");
      return;
    }
    router.push(`/simulados/${dataRes.examId}`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/simulados" className="text-sm text-teal-700 hover:underline">
          ← Minhas listas
        </Link>
        <h1 className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">Nova lista de exercícios</h1>
        <p className="mt-1 text-sm text-slate-600 sm:text-base">
          Registre uma lista que você fez em casa ou no cursinho. Conta como treino na sua jornada —
          peso menor que provas oficiais do catálogo.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card className="space-y-4">
          <div>
            <Label>Nome da lista</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Lista de fixação — Genética"
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label>Data em que você fez</Label>
            <Input
              id="data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label>Quantidade de questões (máx. {MAX_QUESTOES_LISTA})</Label>
            <Input
              id="total"
              type="number"
              min={1}
              max={MAX_QUESTOES_LISTA}
              value={totalQuestoes}
              onChange={(e) => setTotalQuestoes(parseInt(e.target.value, 10) || 1)}
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label>Questões que você errou</Label>
            <Textarea
              id="erros"
              value={listaErros}
              onChange={(e) => setListaErros(e.target.value)}
              placeholder="Ex.: 3, 5, 8-12 ou uma por linha"
              rows={4}
              required
              className="mt-1"
            />
            <p className="mt-1 text-xs text-slate-500">
              As demais questões serão consideradas acertos. Matéria dos erros é estimada pelo número
              (padrão ENEM/60 questões quando couber).
            </p>
          </div>
          <div>
            <Label>Como você se sentiu? (opcional)</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCheckIn(checkIn === n ? null : n)}
                  className={`min-h-11 min-w-11 rounded-xl border text-sm font-medium ${
                    checkIn === n
                      ? "border-teal-600 bg-teal-50 text-teal-800"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" disabled={loading} className="w-full sm:w-auto">
          {loading ? "Salvando..." : "Salvar lista"}
        </Button>
      </form>

      <Card className="border-slate-200 bg-slate-50">
        <p className="text-sm text-slate-600">
          <strong>Simulado de cursinho ou prova oficial?</strong> Use{" "}
          <Link href="/provas" className="text-teal-700 underline">
            Atividades
          </Link>{" "}
          — o gabarito já está no catálogo. Se o simulado ainda não existe,{" "}
          <Link href="/listas/solicitar" className="text-teal-700 underline">
            solicite a inclusão
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}
