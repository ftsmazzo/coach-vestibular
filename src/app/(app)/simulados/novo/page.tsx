"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { taxonomy } from "@/lib/taxonomy";
import { Button, Card, Input, Label, Select } from "@/components/ui";

interface QuestionRow {
  numero: number;
  correto: boolean;
  materiaId: string;
  temaId: string;
  tipoErro: string;
}

export default function NovoSimuladoPage() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [banca, setBanca] = useState("ENEM");
  const [totalQuestoes, setTotalQuestoes] = useState(10);
  const [nota, setNota] = useState("");
  const [checkIn, setCheckIn] = useState(3);
  const [questoes, setQuestoes] = useState<QuestionRow[]>(
    Array.from({ length: 10 }, (_, i) => ({
      numero: i + 1,
      correto: true,
      materiaId: "quimica",
      temaId: "estequiometria",
      tipoErro: "",
    }))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);

  function resizeQuestions(n: number) {
    setTotalQuestoes(n);
    setQuestoes((prev) => {
      const next: QuestionRow[] = [];
      for (let i = 0; i < n; i++) {
        next.push(
          prev[i] ?? {
            numero: i + 1,
            correto: true,
            materiaId: "biologia",
            temaId: "genetica",
            tipoErro: "",
          }
        );
      }
      return next;
    });
  }

  function updateQuestion(index: number, patch: Partial<QuestionRow>) {
    setQuestoes((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...patch };
      if (patch.materiaId) {
        const materia = taxonomy.materias.find((m) => m.id === patch.materiaId);
        copy[index].temaId = materia?.temas[0]?.id ?? "";
      }
      return copy;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (csvFile) {
      const fd = new FormData();
      fd.append("file", csvFile);
      fd.append("nome", nome || "Simulado importado");
      fd.append("data", data);
      const res = await fetch("/api/exams/import", { method: "POST", body: fd });
      const body = await res.json();
      setLoading(false);
      if (!res.ok) {
        setError(body.error ?? "Erro na importação");
        return;
      }
      router.push(`/simulados/${body.exam.id}`);
      return;
    }

    const res = await fetch("/api/exams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome,
        data,
        banca,
        totalQuestoes,
        nota: nota ? parseFloat(nota) : undefined,
        checkInScore: checkIn,
        questoes: questoes.map((q) => ({
          numero: q.numero,
          correto: q.correto,
          materiaId: q.materiaId,
          temaId: q.temaId,
          tipoErro: q.tipoErro || undefined,
        })),
      }),
    });
    const body = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(body.error ?? "Erro ao salvar");
      return;
    }
    router.push(`/simulados/${body.exam.id}`);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Novo simulado</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} required />
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
            </div>
            <div>
              <Label>Banca / estilo</Label>
              <Select value={banca} onChange={(e) => setBanca(e.target.value)}>
                <option value="ENEM">ENEM</option>
                <option value="FUVEST">FUVEST</option>
                <option value="UNICAMP">UNICAMP</option>
                <option value="Outro">Outro</option>
              </Select>
            </div>
            <div>
              <Label>Total de questões</Label>
              <Input
                type="number"
                min={1}
                max={180}
                value={totalQuestoes}
                onChange={(e) => resizeQuestions(parseInt(e.target.value, 10) || 1)}
              />
            </div>
            <div>
              <Label>Nota (opcional)</Label>
              <Input value={nota} onChange={(e) => setNota(e.target.value)} />
            </div>
          </div>

          <div className="mt-4">
            <Label>Como você está? (1 = esgotada · 5 = bem)</Label>
            <div className="mt-2 flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCheckIn(n)}
                  className={`h-10 w-10 rounded-full text-sm font-medium ${
                    checkIn === n ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <Label>Importar CSV (opcional — substitui gabarito manual)</Label>
          <Input
            type="file"
            accept=".csv"
            onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
            className="mt-2"
          />
          <p className="mt-1 text-xs text-slate-500">
            Use o template em docs/templates/simulado-validacao.csv
          </p>
        </Card>

        {!csvFile && (
          <Card>
            <h2 className="mb-4 font-semibold">Gabarito</h2>
            <div className="max-h-96 space-y-3 overflow-y-auto">
              {questoes.map((q, i) => {
                const materia = taxonomy.materias.find((m) => m.id === q.materiaId);
                return (
                  <div
                    key={q.numero}
                    className="grid gap-2 rounded-xl border border-slate-100 p-3 sm:grid-cols-6"
                  >
                    <span className="self-center text-sm font-medium">Q{q.numero}</span>
                    <Select
                      value={q.correto ? "true" : "false"}
                      onChange={(e) => updateQuestion(i, { correto: e.target.value === "true" })}
                    >
                      <option value="true">Acertou</option>
                      <option value="false">Errou</option>
                    </Select>
                    <Select
                      value={q.materiaId}
                      onChange={(e) => updateQuestion(i, { materiaId: e.target.value })}
                    >
                      {taxonomy.materias.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </Select>
                    <Select
                      value={q.temaId}
                      onChange={(e) => updateQuestion(i, { temaId: e.target.value })}
                    >
                      {materia?.temas.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </Select>
                    {!q.correto && (
                      <Select
                        value={q.tipoErro}
                        onChange={(e) => updateQuestion(i, { tipoErro: e.target.value })}
                      >
                        <option value="">Tipo erro</option>
                        {taxonomy.tiposErro.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label}
                          </option>
                        ))}
                      </Select>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {error && <p className="text-sm text-rose-600">{error}</p>}
        <Button type="submit" disabled={loading}>
          {loading ? "Salvando..." : "Salvar e ver diagnóstico"}
        </Button>
      </form>
    </div>
  );
}
