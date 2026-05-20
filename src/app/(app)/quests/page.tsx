"use client";

import { useEffect, useState } from "react";
import { Card, Button, Badge } from "@/components/ui";

interface Quest {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  duracaoMin: number;
  rewardMsg: string | null;
}

export default function QuestsPage() {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [mood, setMood] = useState(3);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/quests");
    const data = await res.json();
    setQuests(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function completeQuest(id: string) {
    await fetch("/api/quests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "done", moodAfter: mood }),
    });
    load();
  }

  const pending = quests.filter((q) => q.status === "pending");
  const done = quests.filter((q) => q.status === "done");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Quests</h1>
        <p className="text-slate-600">Tarefas de 15–45 min ligadas ao seu diagnóstico.</p>
      </div>

      <Card>
        <p className="text-sm font-medium">Como você está agora? (ao concluir uma quest)</p>
        <div className="mt-2 flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setMood(n)}
              className={`h-9 w-9 rounded-full text-sm ${
                mood === n ? "bg-teal-600 text-white" : "bg-slate-100"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </Card>

      {loading ? (
        <p className="text-slate-500">Carregando...</p>
      ) : (
        <>
          <section>
            <h2 className="mb-3 font-semibold">Pendentes</h2>
            {pending.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma quest pendente.</p>
            ) : (
              <ul className="space-y-3">
                {pending.map((q) => (
                  <li key={q.id}>
                    <Card className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="font-medium">{q.titulo}</h3>
                        {q.descricao && (
                          <p className="text-sm text-slate-600">{q.descricao}</p>
                        )}
                        <p className="text-xs text-slate-500">{q.duracaoMin} min</p>
                      </div>
                      <Button onClick={() => completeQuest(q.id)}>Concluir</Button>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {done.length > 0 && (
            <section>
              <h2 className="mb-3 font-semibold">Concluídas</h2>
              <ul className="space-y-3">
                {done.map((q) => (
                  <li key={q.id}>
                    <Card className="bg-emerald-50/50">
                      <div className="flex items-center gap-2">
                        <Badge tone="success">Feita</Badge>
                        <span className="font-medium">{q.titulo}</span>
                      </div>
                      {q.rewardMsg && (
                        <p className="mt-2 text-sm text-emerald-800">{q.rewardMsg}</p>
                      )}
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
