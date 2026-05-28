"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Button } from "@/components/ui";
import type { AnamnesePublicView } from "@/lib/anamnese-types";

export function AnamneseChat({ initial }: { initial: AnamnesePublicView }) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollDown = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollDown();
  }, [view.messages, scrollDown]);

  async function ensureStarted() {
    if (view.status !== "NOT_STARTED") return;
    setLoading(true);
    const res = await fetch("/api/copiloto/anamnese/start", { method: "POST" });
    const json = await res.json();
    setLoading(false);
    if (res.ok) setView(json);
  }

  useEffect(() => {
    if (view.status === "NOT_STARTED") void ensureStarted();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const msg = input.trim();
    if (!msg || loading) return;
    setError("");
    setInput("");
    setLoading(true);

    const res = await fetch("/api/copiloto/anamnese/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg }),
    });
    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(json.error ?? "Não foi possível enviar.");
      setInput(msg);
      return;
    }

    setView(json);
    if (json.status === "COMPLETED" || json.completed) {
      setTimeout(() => router.push("/dashboard"), 2500);
      router.refresh();
    }
  }

  if (view.status === "COMPLETED") {
    return (
      <Card className="border-teal-200 bg-teal-50/40 p-6">
        <p className="text-[10px] font-semibold uppercase text-teal-800">Perfil salvo</p>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-800">
          {view.summary}
        </p>
        <Button className="mt-4" onClick={() => router.push("/dashboard")}>
          Ir para a Home
        </Button>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
        <span>{view.stageLabel ?? "Entrevista"}</span>
        <span>{view.progressPct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-violet-600 transition-all"
          style={{ width: `${view.progressPct}%` }}
        />
      </div>

      <Card className="flex max-h-[min(52vh,420px)] flex-col overflow-hidden p-0">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {view.messages.map((m, i) => (
            <div
              key={`${i}-${m.role}`}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed sm:max-w-[85%] ${
                  m.role === "user"
                    ? "bg-teal-600 text-white"
                    : "border border-slate-100 bg-slate-50 text-slate-800"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <p className="text-xs text-slate-400">Copiloto pensando na próxima pergunta…</p>
          )}
          <div ref={bottomRef} />
        </div>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {view.canContinue ? (
        <form onSubmit={enviar} className="flex flex-col gap-2 sm:flex-row">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Responda com suas palavras — quanto mais concreto, melhor o copiloto te conhece."
            rows={3}
            className="min-h-[80px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
            disabled={loading}
          />
          <Button type="submit" disabled={loading || !input.trim()} className="shrink-0 sm:self-end">
            Enviar
          </Button>
        </form>
      ) : (
        <p className="text-sm text-slate-600">Finalizando seu perfil…</p>
      )}

      <p className="text-center text-xs text-slate-500">
        Conversa guiada — não é chat aberto. Seus dados viram um perfil estruturado, não um histórico
        gigante.
      </p>
    </div>
  );
}
