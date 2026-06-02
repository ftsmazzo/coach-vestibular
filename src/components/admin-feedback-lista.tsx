"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, Badge } from "@/components/ui";

type Feedback = {
  id: string;
  tipo: "BUG" | "SUGESTAO" | "DUVIDA";
  status: "NOVO" | "EM_ANALISE" | "RESOLVIDO" | "ARQUIVADO";
  titulo: string;
  descricao: string;
  esperado: string | null;
  severidade: string | null;
  pagina: string | null;
  contexto: Record<string, unknown> | null;
  temAnexo: boolean;
  notaAdmin: string | null;
  aluno: { nome: string; email: string };
  createdAt: string;
};

const TIPO_LABEL: Record<Feedback["tipo"], { label: string; emoji: string; tone: "danger" | "warning" | "neutral" }> = {
  BUG: { label: "Bug", emoji: "🐞", tone: "danger" },
  SUGESTAO: { label: "Sugestão", emoji: "💡", tone: "warning" },
  DUVIDA: { label: "Dúvida", emoji: "❓", tone: "neutral" },
};

const STATUS_LABEL: Record<Feedback["status"], string> = {
  NOVO: "Novo",
  EM_ANALISE: "Em análise",
  RESOLVIDO: "Resolvido",
  ARQUIVADO: "Arquivado",
};

const STATUS_TONE: Record<Feedback["status"], "danger" | "warning" | "success" | "neutral"> = {
  NOVO: "danger",
  EM_ANALISE: "warning",
  RESOLVIDO: "success",
  ARQUIVADO: "neutral",
};

const PROXIMO_STATUS: Record<Feedback["status"], Feedback["status"] | null> = {
  NOVO: "EM_ANALISE",
  EM_ANALISE: "RESOLVIDO",
  RESOLVIDO: null,
  ARQUIVADO: null,
};

function formatarData(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminFeedbackLista() {
  const [lista, setLista] = useState<Feedback[]>([]);
  const [contagem, setContagem] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<string>("");
  const [filtroTipo, setFiltroTipo] = useState<string>("");
  const [acaoId, setAcaoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filtroStatus) params.set("status", filtroStatus);
    if (filtroTipo) params.set("tipo", filtroTipo);
    const res = await fetch(`/api/admin/feedback?${params.toString()}`);
    const data = await res.json();
    setLoading(false);
    setLista(data.feedbacks ?? []);
    setContagem(data.contagem ?? {});
  }, [filtroStatus, filtroTipo]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function mudarStatus(id: string, status: Feedback["status"]) {
    setAcaoId(id);
    await fetch(`/api/admin/feedback/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setAcaoId(null);
    carregar();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3 text-xs text-slate-600">
        <span>Novos: <strong className="text-rose-600">{contagem.NOVO ?? 0}</strong></span>
        <span>Em análise: <strong className="text-amber-600">{contagem.EM_ANALISE ?? 0}</strong></span>
        <span>Resolvidos: <strong className="text-emerald-600">{contagem.RESOLVIDO ?? 0}</strong></span>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">Todos os status</option>
          <option value="NOVO">Novos</option>
          <option value="EM_ANALISE">Em análise</option>
          <option value="RESOLVIDO">Resolvidos</option>
          <option value="ARQUIVADO">Arquivados</option>
        </select>
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">Todos os tipos</option>
          <option value="BUG">Bugs</option>
          <option value="SUGESTAO">Sugestões</option>
          <option value="DUVIDA">Dúvidas</option>
        </select>
        <Button type="button" variant="ghost" onClick={carregar}>
          Atualizar
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : lista.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600">Nenhum report com esse filtro.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {lista.map((f) => {
            const tipo = TIPO_LABEL[f.tipo];
            const prox = PROXIMO_STATUS[f.status];
            return (
              <Card key={f.id} className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={tipo.tone}>
                        {tipo.emoji} {tipo.label}
                      </Badge>
                      {f.severidade && f.tipo === "BUG" && (
                        <span className="text-xs text-slate-500">severidade: {f.severidade}</span>
                      )}
                      <Badge tone={STATUS_TONE[f.status]}>{STATUS_LABEL[f.status]}</Badge>
                    </div>
                    <h2 className="mt-1 font-semibold text-slate-900">{f.titulo}</h2>
                    <p className="text-xs text-slate-500">
                      {f.aluno.nome} · {f.aluno.email} · {formatarData(f.createdAt)}
                    </p>
                  </div>
                </div>

                <p className="whitespace-pre-line text-sm text-slate-700">{f.descricao}</p>
                {f.esperado && (
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    <span className="font-medium">Esperava:</span> {f.esperado}
                  </p>
                )}

                <details className="rounded-lg border border-slate-100 bg-slate-50/60 text-xs">
                  <summary className="cursor-pointer px-3 py-2 font-medium text-slate-600">
                    Contexto técnico {f.pagina ? `· ${f.pagina}` : ""}
                  </summary>
                  <div className="space-y-1 px-3 py-2 text-slate-600">
                    {f.pagina && <p>Página: {f.pagina}</p>}
                    {f.contexto &&
                      Object.entries(f.contexto).map(([k, v]) => (
                        <p key={k} className="break-words">
                          {k}: {String(v)}
                        </p>
                      ))}
                  </div>
                </details>

                <div className="flex flex-wrap gap-2">
                  {f.temAnexo && (
                    <a
                      href={`/api/admin/feedback/${f.id}/anexo`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
                    >
                      Ver print
                    </a>
                  )}
                  {prox && (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={acaoId === f.id}
                      onClick={() => mudarStatus(f.id, prox)}
                    >
                      {acaoId === f.id ? "..." : `Marcar ${STATUS_LABEL[prox].toLowerCase()}`}
                    </Button>
                  )}
                  {f.status !== "ARQUIVADO" && (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={acaoId === f.id}
                      onClick={() => mudarStatus(f.id, "ARQUIVADO")}
                    >
                      Arquivar
                    </Button>
                  )}
                  {f.status === "ARQUIVADO" && (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={acaoId === f.id}
                      onClick={() => mudarStatus(f.id, "NOVO")}
                    >
                      Reabrir
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
