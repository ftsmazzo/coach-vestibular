"use client";

import { useRouter } from "next/navigation";
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
  const [provas, setProvas] = useState<ProvaOption[]>([]);
  const [provaId, setProvaId] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [checkIn, setCheckIn] = useState(3);
  const [respostas, setRespostas] = useState("");
  const [listaErros, setListaErros] = useState("");
  const [modo, setModo] = useState<"respostas" | "erros">("respostas");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/provas")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setProvas(data);
          if (data[0]) setProvaId(data[0].id);
        }
      });
  }, []);

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
      checkInScore: checkIn,
    };

    if (modo === "respostas") {
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
        <h1 className="text-2xl font-bold">Registrar tentativa</h1>
        <p className="mt-1 text-slate-600">
          Escolha a prova que o admin cadastrou. Você só informa suas respostas ou os números que
          errou — matéria, assunto e gabarito já estão na prova.
        </p>
      </div>

      {provas.length === 0 ? (
        <Card>
          <p className="text-slate-600">
            Nenhuma prova publicada ainda. O admin precisa cadastrar em{" "}
            <strong>Admin → Banco de provas</strong> e publicar.
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
                  {formatProvaLabel(p)} — {p.totalQuestoes} questões
                  {p.gabaritoCompleto ? "" : " (gabarito parcial)"}
                </option>
              ))}
            </select>
            {prova && (
              <p className="mt-2 text-xs text-slate-500">
                {prova.banca} · {prova.questoesCount} questões no banco
              </p>
            )}
          </Card>

          <Card className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div>
              <Label>Como você está? (1–5)</Label>
              <div className="mt-2 flex gap-2">
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
              </div>
            </div>
          </Card>

          <Card>
            <div className="mb-4 flex gap-2">
              <button
                type="button"
                onClick={() => setModo("respostas")}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  modo === "respostas" ? "bg-teal-600 text-white" : "bg-slate-100"
                }`}
              >
                Minhas respostas (recomendado)
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

            {modo === "respostas" ? (
              <div>
                <Label>
                  Suas {prova?.totalQuestoes ?? 60} respostas (só letras A–E, na ordem)
                </Label>
                <textarea
                  className="mt-1 w-full rounded-xl border p-3 font-mono text-sm"
                  rows={4}
                  placeholder="Cole a sequência do seu caderno ou do GPT..."
                  value={respostas}
                  onChange={(e) => setRespostas(e.target.value)}
                />
                <p className="mt-2 text-xs text-slate-500">
                  O sistema compara com o gabarito cadastrado na prova e usa matéria/assunto de cada
                  questão para o diagnóstico.
                </p>
              </div>
            ) : (
              <div>
                <Label>Questões erradas</Label>
                <textarea
                  className="mt-1 w-full rounded-xl border p-3 text-sm"
                  rows={3}
                  placeholder="3, 8, 12-15, 40"
                  value={listaErros}
                  onChange={(e) => setListaErros(e.target.value)}
                />
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
