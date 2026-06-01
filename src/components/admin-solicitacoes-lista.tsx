"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Badge } from "@/components/ui";
import {
  STATUS_SOLICITACAO_PENDENTE,
  STATUS_SOLICITACAO_PROCESSADA,
  formatBytes,
} from "@/lib/solicitacao-simulado";

type Solicitacao = {
  id: string;
  fileName: string;
  status: string;
  storagePath: string | null;
  temArquivo: boolean;
  createdAt: string;
  user: { id: string; name: string; email: string };
  nome: string;
  banca: string | null;
  observacao: string | null;
  tamanhoBytes?: number;
  mimeType?: string;
  gabaritoTexto?: string | null;
  gabaritoFileName?: string | null;
  temGabaritoArquivo?: boolean;
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

export function AdminSolicitacoesLista() {
  const [lista, setLista] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<"pendentes" | "todas">("pendentes");
  const [acaoId, setAcaoId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    const q = filtro === "pendentes" ? "?pendentes=1" : "";
    const res = await fetch(`/api/admin/solicitacoes${q}`);
    const data = await res.json();
    setLoading(false);
    if (Array.isArray(data)) setLista(data);
    else setLista([]);
  }, [filtro]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function alterarStatus(id: string, acao: "processar" | "reabrir") {
    setAcaoId(id);
    setMsg("");
    const res = await fetch(`/api/admin/solicitacoes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao }),
    });
    const data = await res.json();
    setAcaoId(null);
    if (!res.ok) {
      setMsg(data.error ?? "Erro");
      return;
    }
    setMsg(data.mensagem ?? "Atualizado");
    await carregar();
  }

  const pendentes = lista.filter((s) => s.status === STATUS_SOLICITACAO_PENDENTE);
  const processadas = lista.filter((s) => s.status === STATUS_SOLICITACAO_PROCESSADA);

  if (loading) {
    return <p className="text-sm text-slate-500">Carregando solicitações...</p>;
  }

  return (
    <div className="space-y-6">
      {msg && (
        <p className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800">{msg}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={filtro === "pendentes" ? "primary" : "secondary"}
          onClick={() => setFiltro("pendentes")}
        >
          Pendentes
        </Button>
        <Button
          type="button"
          variant={filtro === "todas" ? "primary" : "secondary"}
          onClick={() => setFiltro("todas")}
        >
          Todas
        </Button>
        <Button type="button" variant="ghost" onClick={() => carregar()}>
          Atualizar
        </Button>
      </div>

      {lista.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600">
            Nenhuma solicitação {filtro === "pendentes" ? "pendente" : "registrada"}.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {(filtro === "pendentes" ? pendentes : lista).map((s) => (
            <Card key={s.id} className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-slate-900">{s.nome}</h2>
                  <p className="text-sm text-slate-600">
                    {s.user.name} · {s.user.email}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{formatarData(s.createdAt)}</p>
                </div>
                <Badge
                  tone={s.status === STATUS_SOLICITACAO_PENDENTE ? "warning" : "neutral"}
                >
                  {s.status === STATUS_SOLICITACAO_PENDENTE ? "Pendente" : "Processada"}
                </Badge>
              </div>

              <dl className="grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
                {s.banca && (
                  <>
                    <dt className="text-slate-500">Cursinho / banca</dt>
                    <dd>{s.banca}</dd>
                  </>
                )}
                <dt className="text-slate-500">Arquivo</dt>
                <dd className="truncate">
                  {s.fileName}
                  {s.tamanhoBytes != null && (
                    <span className="text-slate-500"> · {formatBytes(s.tamanhoBytes)}</span>
                  )}
                </dd>
                {s.observacao && (
                  <>
                    <dt className="text-slate-500">Observações</dt>
                    <dd className="sm:col-span-1">{s.observacao}</dd>
                  </>
                )}
                <dt className="text-slate-500">Gabarito oficial</dt>
                <dd>
                  {s.gabaritoTexto || s.temGabaritoArquivo ? (
                    <span className="font-medium text-emerald-700">Enviado pelo aluno ✓</span>
                  ) : (
                    <span className="text-slate-400">Não enviado</span>
                  )}
                </dd>
              </dl>

              {s.gabaritoTexto && (
                <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                    Gabarito colado pelo aluno
                  </p>
                  <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-xs text-slate-800">
                    {s.gabaritoTexto}
                  </pre>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {s.temArquivo ? (
                  <a
                    href={`/api/admin/solicitacoes/${s.id}/arquivo`}
                    className="inline-flex items-center rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
                    download
                  >
                    Baixar PDF/foto
                  </a>
                ) : (
                  <span className="text-sm text-amber-700">
                    Arquivo indisponível — pedir reenvio ao aluno
                  </span>
                )}
                {s.temGabaritoArquivo && (
                  <a
                    href={`/api/admin/solicitacoes/${s.id}/arquivo?tipo=gabarito`}
                    className="inline-flex items-center rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800"
                    download
                  >
                    Baixar gabarito
                  </a>
                )}
                <Link href="/admin/provas">
                  <Button type="button" variant="secondary">
                    Cadastrar prova
                  </Button>
                </Link>
                {s.status === STATUS_SOLICITACAO_PENDENTE ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={acaoId === s.id}
                    onClick={() => alterarStatus(s.id, "processar")}
                  >
                    {acaoId === s.id ? "..." : "Marcar processada"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={acaoId === s.id}
                    onClick={() => alterarStatus(s.id, "reabrir")}
                  >
                    Reabrir
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {filtro === "todas" && processadas.length > 0 && pendentes.length > 0 && (
        <p className="text-xs text-slate-500">
          {pendentes.length} pendente(s), {processadas.length} processada(s) nesta lista.
        </p>
      )}
    </div>
  );
}
