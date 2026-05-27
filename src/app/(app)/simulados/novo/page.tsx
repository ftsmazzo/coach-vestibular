"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ModoUsoSelector } from "@/components/modo-uso-selector";
import { Button, Card, Input, Label } from "@/components/ui";
import type { ModoUsoRegistro, ProvaTipo } from "@/generated/prisma/client";
import { parseListaErros } from "@/lib/gabarito";
import { modoUsoPadraoParaProva } from "@/lib/modo-uso";
import { formatProvaLabel } from "@/lib/prova-label";

interface TentativaResumo {
  id: string;
  dataLabel: string;
  dataInput: string;
  pctAcerto: number;
  acertos: number;
  total: number;
}

interface ProvaOption {
  id: string;
  nome: string;
  banca: string;
  tipo?: ProvaTipo;
  ano?: number | null;
  caderno?: string | null;
  totalQuestoes: number;
  gabaritoCompleto: boolean;
  questoesCount: number;
  minhasTentativas?: number;
  tentativas: TentativaResumo[];
}

type ModoRegistro = "substituir" | "nova";

export default function NovoSimuladoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const provaIdInicial = searchParams.get("provaId") ?? "";
  const [provas, setProvas] = useState<ProvaOption[]>([]);
  const [provaId, setProvaId] = useState("");
  const [data, setData] = useState("");
  const [modoRegistro, setModoRegistro] = useState<ModoRegistro>("nova");
  const [substituirExamId, setSubstituirExamId] = useState("");
  const [checkIn, setCheckIn] = useState<number | null>(null);
  const [gabaritoAluno, setGabaritoAluno] = useState("");
  const [respostas, setRespostas] = useState("");
  const [listaErros, setListaErros] = useState("");
  const [modo, setModo] = useState<"gabarito" | "sequencia" | "erros">("gabarito");
  const [modoUso, setModoUso] = useState<ModoUsoRegistro>("OFICIAL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/provas")
      .then((r) => r.json())
      .then((lista) => {
        if (!Array.isArray(lista)) return;
        const normalizada: ProvaOption[] = lista.map((p: ProvaOption) => ({
          ...p,
          tentativas: p.tentativas ?? [],
        }));
        setProvas(normalizada);
        const pre =
          provaIdInicial && normalizada.some((p) => p.id === provaIdInicial)
            ? provaIdInicial
            : normalizada[0]?.id ?? "";
        setProvaId(pre);
      });
  }, [provaIdInicial]);

  const prova = provas.find((p) => p.id === provaId);
  const tentativas = prova?.tentativas ?? [];
  const jaRegistrou = tentativas.length > 0;

  useEffect(() => {
    if (!prova) return;
    if (tentativas.length > 0) {
      setModoRegistro("substituir");
      const alvo = tentativas[0];
      setSubstituirExamId(alvo.id);
      setData(alvo.dataInput);
    } else {
      setModoRegistro("nova");
      setSubstituirExamId("");
      setData("");
    }
  }, [provaId, provas]);

  useEffect(() => {
    if (modoRegistro === "substituir" && substituirExamId) {
      const t = tentativas.find((x) => x.id === substituirExamId);
      if (t) setData(t.dataInput);
    }
  }, [modoRegistro, substituirExamId, tentativas]);

  useEffect(() => {
    if (prova?.tipo) {
      setModoUso(modoUsoPadraoParaProva(prova.tipo));
    }
  }, [provaId, prova?.tipo]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!provaId) {
      setError("Selecione uma prova cadastrada pelo admin.");
      return;
    }
    if (!data.trim()) {
      setError("Informe a data em que você fez a prova (dia da aplicação).");
      return;
    }
    if (modoRegistro === "substituir" && jaRegistrou && !substituirExamId) {
      setError("Selecione qual registro deseja substituir.");
      return;
    }

    setLoading(true);
    setError("");

    const body: Record<string, unknown> = {
      provaId,
      data,
      modoUso,
    };
    if (checkIn != null) body.checkInScore = checkIn;
    if (modoRegistro === "substituir" && substituirExamId) {
      body.substituirExamId = substituirExamId;
    }

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
          Seu gabarito é comparado com o oficial do admin. Use a data em que você{" "}
          <strong>fez a prova</strong>, não o dia em que está cadastrando aqui — o gráfico de
          evolução usa essa data.
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
                  {(p.tentativas?.length ?? 0) > 0
                    ? ` · ${p.tentativas.length} registro(s) seu(s)`
                    : ""}
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

          {jaRegistrou && (
            <Card className="border-amber-200 bg-amber-50/80">
              <p className="font-medium text-amber-950">
                Você já tem resultado desta prova
              </p>
              <p className="mt-1 text-sm text-amber-900">
                Não é um cadastro em branco — escolha se quer <strong>substituir</strong> um
                registro (apaga o antigo e gera outro) ou criar uma <strong>nova tentativa</strong>{" "}
                (por exemplo, refez em outra data).
              </p>
              <ul className="mt-3 space-y-2">
                {tentativas.map((t) => (
                  <li
                    key={t.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 px-3 py-2 text-sm"
                  >
                    <span>
                      Aplicada em <strong>{t.dataLabel}</strong> · {t.pctAcerto}% ({t.acertos}/
                      {t.total})
                    </span>
                    <Link
                      href={`/simulados/${t.id}`}
                      className="text-teal-700 font-medium hover:underline"
                    >
                      Ver diagnóstico →
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setModoRegistro("substituir")}
                  className={`rounded-lg px-3 py-1.5 text-sm ${
                    modoRegistro === "substituir"
                      ? "bg-amber-700 text-white"
                      : "bg-white text-slate-700 ring-1 ring-amber-200"
                  }`}
                >
                  Substituir registro
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModoRegistro("nova");
                    setSubstituirExamId("");
                    setData("");
                  }}
                  className={`rounded-lg px-3 py-1.5 text-sm ${
                    modoRegistro === "nova"
                      ? "bg-teal-600 text-white"
                      : "bg-white text-slate-700 ring-1 ring-slate-200"
                  }`}
                >
                  Nova tentativa (outra data)
                </button>
              </div>

              {modoRegistro === "substituir" && tentativas.length > 1 && (
                <div className="mt-3">
                  <Label>Qual registro substituir?</Label>
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={substituirExamId}
                    onChange={(e) => setSubstituirExamId(e.target.value)}
                  >
                    {tentativas.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.dataLabel} — {t.pctAcerto}%
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {modoRegistro === "substituir" && (
                <p className="mt-2 text-xs text-amber-800">
                  O registro selecionado será apagado ao salvar; diagnóstico e plano serão
                  recalculados.
                </p>
              )}
            </Card>
          )}

          <Card>
            <Label>Como você usou esta prova?</Label>
            <p className="mt-1 text-xs text-slate-500">
              Isso define o peso no seu plano e na jornada — independente do tipo cadastrado pelo
              admin.
            </p>
            <div className="mt-3">
              <ModoUsoSelector value={modoUso} onChange={setModoUso} />
            </div>
          </Card>

          <Card className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Data em que você fez a prova</Label>
              <Input
                type="date"
                required
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-500">
                Dia da aplicação (ENEM, simulado da escola, etc.), não o dia em que você está
                preenchendo aqui. O gráfico de evolução usa essa data.
              </p>
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
                    Gabarito oficial ainda incompleto nesta prova — o percentual de acertos pode
                    ficar limitado até o admin publicar o oficial.
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
            {loading
              ? "Analisando..."
              : modoRegistro === "substituir" && jaRegistrou
                ? "Substituir e gerar diagnóstico"
                : "Gerar diagnóstico e plano"}
          </Button>
        </form>
      )}
    </div>
  );
}
