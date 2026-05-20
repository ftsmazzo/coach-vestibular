"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { GabaritoGrid } from "@/components/gabarito-grid";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import {
  aplicarMapaEnem,
  compararGabarito,
  mesclarComAnalise,
  parseAnaliseAssistente,
  parseListaErros,
  questoesFromListaErros,
  type QuestaoInput,
} from "@/lib/gabarito";

type Modo = "gabarito" | "erros" | "grade";

const PRESETS = [45, 60, 90, 180];

export default function NovoSimuladoPage() {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>("gabarito");
  const [nome, setNome] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [banca, setBanca] = useState("ENEM");
  const [totalQuestoes, setTotalQuestoes] = useState(60);
  const [nota, setNota] = useState("");
  const [checkIn, setCheckIn] = useState(3);
  const [mapaAutomatico, setMapaAutomatico] = useState(true);

  const [gabaritoOficial, setGabaritoOficial] = useState("");
  const [respostasAluno, setRespostasAluno] = useState("");
  const [listaErros, setListaErros] = useState("");
  const [analiseGpt, setAnaliseGpt] = useState("");
  const [acertosGrade, setAcertosGrade] = useState<Set<number>>(() => new Set());

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const preview = useMemo(() => {
    let q: QuestaoInput[] = [];
    if (modo === "gabarito") {
      if (gabaritoOficial.length < 2 || respostasAluno.length < 2) return null;
      q = compararGabarito(gabaritoOficial, respostasAluno, totalQuestoes);
    } else if (modo === "erros") {
      const erros = parseListaErros(listaErros);
      q = questoesFromListaErros(totalQuestoes, erros);
    } else {
      q = Array.from({ length: totalQuestoes }, (_, i) => ({
        numero: i + 1,
        correto: acertosGrade.has(i + 1),
      }));
    }
    if (mapaAutomatico) q = aplicarMapaEnem(q, totalQuestoes);
    if (analiseGpt.trim()) {
      q = mesclarComAnalise(q, parseAnaliseAssistente(analiseGpt));
    }
    const acertos = q.filter((x) => x.correto).length;
    return { q, acertos, erros: totalQuestoes - acertos };
  }, [
    modo,
    gabaritoOficial,
    respostasAluno,
    listaErros,
    totalQuestoes,
    acertosGrade,
    mapaAutomatico,
    analiseGpt,
  ]);

  function resizeTotal(n: number) {
    const safe = Math.min(180, Math.max(1, n));
    setTotalQuestoes(safe);
    setAcertosGrade(new Set(Array.from({ length: safe }, (_, i) => i + 1)));
  }

  function toggleGrade(numero: number) {
    setAcertosGrade((prev) => {
      const next = new Set(prev);
      if (next.has(numero)) next.delete(numero);
      else next.add(numero);
      return next;
    });
  }

  function buildQuestoes(): QuestaoInput[] {
    if (!preview) throw new Error("Preencha o gabarito antes de salvar.");
    return preview.q;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const questoes = buildQuestoes();
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
            tipoErro: q.tipoErro,
          })),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Erro ao salvar");
        return;
      }
      router.push(`/simulados/${body.exam.id}`);
    } catch {
      setError("Confira os campos do gabarito e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const modos: { id: Modo; label: string; desc: string }[] = [
    {
      id: "gabarito",
      label: "Gabarito x suas respostas",
      desc: "Cole as 60 letras (A–E) — o mais rápido se você tem o gabarito",
    },
    {
      id: "erros",
      label: "Só os erros",
      desc: "Informe apenas os números que errou: 3, 8, 12-15",
    },
    {
      id: "grade",
      label: "Grade visual",
      desc: "Clique nas questões erradas na grade",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Novo simulado</h1>
        <p className="mt-1 text-slate-600">
          Provas com ~60 questões: sem tema manual questão a questão. Cole gabarito, liste erros ou
          use a grade. Temas vêm do mapa ENEM, da análise do GPT ou do upload (em breve).
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Nome do simulado</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} required />
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
            </div>
            <div>
              <Label>Banca</Label>
              <Select value={banca} onChange={(e) => setBanca(e.target.value)}>
                <option value="ENEM">ENEM</option>
                <option value="FUVEST">FUVEST</option>
                <option value="UNICAMP">UNICAMP</option>
                <option value="Cursinho">Cursinho / outro</option>
              </Select>
            </div>
            <div>
              <Label>Total de questões</Label>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => resizeTotal(p)}
                    className={`rounded-lg px-3 py-1 text-sm ${
                      totalQuestoes === p
                        ? "bg-teal-600 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <Input
                  type="number"
                  min={1}
                  max={180}
                  value={totalQuestoes}
                  onChange={(e) => resizeTotal(parseInt(e.target.value, 10) || 60)}
                  className="w-20"
                />
              </div>
            </div>
          </div>

          <div className="mt-4">
            <Label>Como você está? (1–5)</Label>
            <div className="mt-2 flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCheckIn(n)}
                  className={`h-10 w-10 rounded-full text-sm font-medium ${
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
          <h2 className="mb-3 font-semibold">Como registrar?</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {modos.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setModo(m.id)}
                className={`rounded-xl border p-3 text-left text-sm ${
                  modo === m.id
                    ? "border-teal-500 bg-teal-50"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span className="font-medium">{m.label}</span>
                <span className="mt-1 block text-xs text-slate-500">{m.desc}</span>
              </button>
            ))}
          </div>
        </Card>

        {modo === "gabarito" && (
          <Card className="space-y-4">
            <div>
              <Label>Gabarito oficial (só letras, ex. 60 caracteres)</Label>
              <textarea
                className="mt-1 w-full rounded-xl border border-slate-200 p-3 font-mono text-sm"
                rows={3}
                placeholder="ABCDEABCDE... (pode colar em linha ou bloco)"
                value={gabaritoOficial}
                onChange={(e) => setGabaritoOficial(e.target.value)}
              />
            </div>
            <div>
              <Label>Suas respostas (mesma ordem)</Label>
              <textarea
                className="mt-1 w-full rounded-xl border border-slate-200 p-3 font-mono text-sm"
                rows={3}
                placeholder="Suas 60 alternativas marcadas no caderno"
                value={respostasAluno}
                onChange={(e) => setRespostasAluno(e.target.value)}
              />
            </div>
            <p className="text-xs text-slate-500">
              Dica: tire foto do gabarito e peça ao GPT para extrair só a sequência de letras.
            </p>
          </Card>
        )}

        {modo === "erros" && (
          <Card>
            <Label>Só informe os números que errou</Label>
            <textarea
              className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm"
              rows={3}
              placeholder="Ex.: 3, 5, 8-12, 40, 55"
              value={listaErros}
              onChange={(e) => setListaErros(e.target.value)}
            />
            <p className="mt-2 text-xs text-slate-500">
              Todas as outras questões serão consideradas acertos.
            </p>
          </Card>
        )}

        {modo === "grade" && (
          <Card>
            <GabaritoGrid
              total={totalQuestoes}
              acertos={acertosGrade}
              onToggle={toggleGrade}
              onMarkAllCorrect={() =>
                setAcertosGrade(new Set(Array.from({ length: totalQuestoes }, (_, i) => i + 1)))
              }
            />
          </Card>
        )}

        <Card className="space-y-3 border-dashed border-teal-200 bg-teal-50/30">
          <h2 className="font-semibold text-teal-900">Análise do GPT / cursinho (temas)</h2>
          <p className="text-sm text-teal-800">
            Cole aqui a saída do seu agente (questão + tema). O sistema associa aos erros — sem
            preencher 60 linhas manualmente.
          </p>
          <textarea
            className="w-full rounded-xl border border-teal-200 bg-white p-3 text-sm"
            rows={6}
            placeholder={`Exemplo:\nQ3 - Estequiometria\nQuestão 8: Cinemática\n12) Fisiologia Humana - base teórica`}
            value={analiseGpt}
            onChange={(e) => setAnaliseGpt(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={mapaAutomatico}
              onChange={(e) => setMapaAutomatico(e.target.checked)}
            />
            Estimar matéria por bloco ENEM (60 ou 180 questões) quando não houver tema no GPT
          </label>
        </Card>

        {preview && (
          <Card className="bg-slate-50">
            <p className="text-sm font-medium text-slate-800">
              Prévia: {preview.acertos} acertos · {preview.erros} erros (
              {Math.round((preview.acertos / totalQuestoes) * 100)}%)
            </p>
            {preview.erros > 0 && !analiseGpt.trim() && !mapaAutomatico && (
              <p className="mt-1 text-xs text-amber-700">
                Sem temas ainda — cole a análise do GPT acima para diagnóstico por tema.
              </p>
            )}
          </Card>
        )}

        <Card className="border-slate-200 bg-slate-50">
          <p className="text-sm text-slate-600">
            <strong>Em breve (Fase 2):</strong> upload do PDF/foto do caderno + gabarito; IA extrai
            questões e classifica temas automaticamente — como no seu agente GPT.
          </p>
          <a href="/simulados/upload" className="mt-2 inline-block text-sm text-teal-700 underline">
            Enviar arquivo (preview)
          </a>
        </Card>

        {error && <p className="text-sm text-rose-600">{error}</p>}
        <Button type="submit" disabled={loading || !preview}>
          {loading ? "Salvando..." : "Salvar e ver diagnóstico"}
        </Button>
      </form>
    </div>
  );
}
