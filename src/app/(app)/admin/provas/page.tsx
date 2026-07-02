"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { buildProvaNome } from "@/lib/prova-nome";
import {
  hrefAdminProva,
  provaPassaFiltroLista,
  provaTemPendencias,
  type FiltroListaProvas,
} from "@/lib/prova-pendencias-admin";

interface Prova {
  id: string;
  nome: string;
  banca: string;
  tipo: string;
  totalQuestoes: number;
  publicada: boolean;
  gabaritoCompleto: boolean;
  questoesCadastradas: number;
  bancoIncompleto: boolean;
  questoesFaltando: number[];
  questoesRevisaoImagem?: number[];
  _count: { questoes: number; tentativas: number };
}

const FILTROS: { id: FiltroListaProvas; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "pendencias", label: "Com pendências" },
  { id: "banco_incompleto", label: "Banco incompleto" },
  { id: "texto_incompleto", label: "Texto incompleto" },
  { id: "gabarito_pendente", label: "Gabarito pendente" },
  { id: "rascunho", label: "Rascunhos" },
];

export default function AdminProvasPage() {
  const [provas, setProvas] = useState<Prova[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroListaProvas>("todas");
  const [busca, setBusca] = useState("");
  const [diag, setDiag] = useState<{
    contagens?: { provas: number };
    envPerigoso?: { confirmarReset?: boolean };
    banco?: { tipo?: string; host?: string | null };
  } | null>(null);
  const [form, setForm] = useState({
    banca: "ENEM",
    tipo: "SIMULADO",
    ano: "" as string | number,
    dia: "" as string | number,
    caderno: "",
    totalQuestoes: 60,
  });

  async function load() {
    setCarregando(true);
    setErro(null);
    try {
      const [resProvas, resDiag] = await Promise.all([
        fetch("/api/admin/provas"),
        fetch("/api/admin/diagnostico"),
      ]);

      if (resProvas.status === 401) {
        setErro("Sessão expirada. Faça login novamente.");
        setProvas([]);
        return;
      }
      if (resProvas.status === 403) {
        setErro("Acesso negado — entre com uma conta de administrador.");
        setProvas([]);
        return;
      }
      if (!resProvas.ok) {
        setErro(`Erro ao carregar provas (HTTP ${resProvas.status}).`);
        setProvas([]);
        return;
      }

      setProvas(await resProvas.json());

      if (resDiag.ok) {
        setDiag(await resDiag.json());
      }
    } catch {
      setErro("Falha de rede ao carregar o banco de provas.");
      setProvas([]);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const contadores = useMemo(() => {
    let pendencias = 0;
    let banco = 0;
    let texto = 0;
    let gabarito = 0;
    let rascunho = 0;
    for (const p of provas) {
      if (provaTemPendencias(p)) pendencias++;
      if (p.bancoIncompleto || (p.totalQuestoes > 0 && p.questoesCadastradas === 0)) banco++;
      if ((p.questoesRevisaoImagem?.length ?? 0) > 0) texto++;
      if (p.questoesCadastradas > 0 && !p.gabaritoCompleto) gabarito++;
      if (!p.publicada) rascunho++;
    }
    return { pendencias, banco, texto, gabarito, rascunho };
  }, [provas]);

  const provasFiltradas = useMemo(
    () => provas.filter((p) => provaPassaFiltroLista(p, filtro, busca)),
    [provas, filtro, busca]
  );

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/provas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        ano: form.ano ? parseInt(String(form.ano), 10) : undefined,
        dia: form.dia ? parseInt(String(form.dia), 10) : undefined,
        caderno: form.caderno || undefined,
      }),
    });
    setForm({
      banca: "ENEM",
      tipo: "SIMULADO",
      ano: "",
      dia: "",
      caderno: "",
      totalQuestoes: 60,
    });
    load();
  }

  function acaoRapida(p: Prova): { href: string; label: string } {
    const revisao = p.questoesRevisaoImagem ?? [];
    if (revisao.length > 0) {
      return {
        href: hrefAdminProva(p.id, { aba: "questoes", q: revisao[0] }),
        label: "Completar texto",
      };
    }
    if (p.bancoIncompleto && p.questoesFaltando.length > 0) {
      return {
        href: hrefAdminProva(p.id, { aba: "questoes", q: p.questoesFaltando[0] }),
        label: "Completar banco",
      };
    }
    if (!p.gabaritoCompleto && p.questoesCadastradas > 0) {
      return { href: hrefAdminProva(p.id, { aba: "pedagogia" }), label: "Gabarito" };
    }
    return { href: hrefAdminProva(p.id), label: "Gerenciar" };
  }

  const formNovaProva = (
    <Card>
      <h2 className="mb-4 font-semibold">Nova prova</h2>
      <form onSubmit={criar} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>Nome da prova (gerado automaticamente)</Label>
          <p className="mt-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {buildProvaNome({
              banca: form.banca,
              ano: form.ano ? parseInt(String(form.ano), 10) : null,
              dia: form.dia ? parseInt(String(form.dia), 10) : null,
              caderno: form.caderno || null,
            }) || "Preencha banca, ano e caderno"}
          </p>
        </div>
        <div>
          <Label>Banca / vestibular</Label>
          <Input
            value={form.banca}
            onChange={(e) => setForm({ ...form, banca: e.target.value })}
            placeholder="ENEM, UFU, Fuvest..."
          />
        </div>
        <div>
          <Label>Ano</Label>
          <Input
            type="number"
            value={form.ano}
            onChange={(e) => setForm({ ...form, ano: e.target.value })}
            placeholder="2025"
          />
        </div>
        <div>
          <Label>Caderno / tipo</Label>
          <Input
            value={form.caderno}
            onChange={(e) => setForm({ ...form, caderno: e.target.value })}
            placeholder="Azul, Tipo 1, 1º dia Natureza..."
          />
        </div>
        <div>
          <Label>Dia (ENEM)</Label>
          <Input
            type="number"
            value={form.dia}
            onChange={(e) => setForm({ ...form, dia: e.target.value })}
            placeholder="1 ou 2"
          />
        </div>
        <div>
          <Label>Tipo</Label>
          <Select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
            <option value="ENEM_OFICIAL">ENEM oficial</option>
            <option value="SIMULADO">Simulado cursinho</option>
            <option value="VESTIBULAR">Vestibular</option>
            <option value="OUTRO">Outro</option>
          </Select>
        </div>
        <div>
          <Label>Total de questões</Label>
          <Input
            type="number"
            value={form.totalQuestoes}
            onChange={(e) =>
              setForm({ ...form, totalQuestoes: parseInt(e.target.value, 10) || 60 })
            }
          />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit">Criar prova</Button>
        </div>
      </form>
    </Card>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Banco de provas</h1>
        <p className="text-slate-600">
          Cadastre vestibulares e gerencie extração, lacunas e classificação em três abas por prova.
        </p>
      </div>

      {provas.length === 0 ? formNovaProva : (
        <details className="group">
          <summary className="cursor-pointer list-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50">
            + Nova prova
          </summary>
          <div className="mt-3">{formNovaProva}</div>
        </details>
      )}

      {erro && (
        <Card className="border-rose-200 bg-rose-50">
          <p className="text-sm font-medium text-rose-900">{erro}</p>
        </Card>
      )}

      {diag?.envPerigoso?.confirmarReset && (
        <Card className="border-rose-300 bg-rose-50">
          <p className="text-sm font-medium text-rose-900">
            CONFIRMAR_RESET=true está ativo no servidor — cada deploy apaga todas as provas.
            Remova essa variável no EasyPanel e faça redeploy.
          </p>
        </Card>
      )}

      {carregando && <p className="text-sm text-slate-500">Carregando banco de provas…</p>}

      {!carregando && !erro && provas.length === 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <h2 className="font-semibold text-amber-950">Nenhuma prova no banco</h2>
          <p className="mt-2 text-sm text-amber-900">
            O painel está funcionando, mas o PostgreSQL não tem provas gravadas.
            {diag?.banco?.host ? (
              <>
                {" "}
                Banco conectado: <strong>{diag.banco.tipo}</strong> em{" "}
                <strong>{diag.banco.host}</strong>.
              </>
            ) : null}
          </p>
        </Card>
      )}

      {provas.length > 0 && (
        <Card>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">Provas cadastradas</h2>
              <p className="text-sm text-slate-600">
                {provasFiltradas.length} de {provas.length} exibidas
                {contadores.pendencias > 0 && (
                  <span className="text-amber-800"> · {contadores.pendencias} com pendências</span>
                )}
              </p>
            </div>
            <div className="w-full sm:max-w-xs">
              <Label>Buscar</Label>
              <Input
                placeholder="Nome ou banca…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {FILTROS.map((f) => {
              const count =
                f.id === "todas"
                  ? provas.length
                  : f.id === "pendencias"
                    ? contadores.pendencias
                    : f.id === "banco_incompleto"
                      ? contadores.banco
                      : f.id === "texto_incompleto"
                        ? contadores.texto
                        : f.id === "gabarito_pendente"
                          ? contadores.gabarito
                          : f.id === "rascunho"
                            ? contadores.rascunho
                            : 0;
              if (f.id !== "todas" && count === 0) return null;
              return (
                <Button
                  key={f.id}
                  type="button"
                  variant={filtro === f.id ? "primary" : "secondary"}
                  className="text-xs"
                  onClick={() => setFiltro(f.id)}
                >
                  {f.label} ({count})
                </Button>
              );
            })}
          </div>
        </Card>
      )}

      <ul className="space-y-3">
        {provasFiltradas.map((p) => {
          const revisao = p.questoesRevisaoImagem?.length ?? 0;
          const acao = acaoRapida(p);
          return (
            <li key={p.id}>
              <Card className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">{p.nome}</h3>
                  <p className="text-xs text-slate-500">{p.banca}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.bancoIncompleto
                          ? "bg-amber-100 text-amber-950"
                          : "bg-emerald-100 text-emerald-900"
                      }`}
                    >
                      {p.questoesCadastradas}/{p.totalQuestoes} no banco
                    </span>
                    {revisao > 0 && (
                      <Link
                        href={hrefAdminProva(p.id, {
                          aba: "pedagogia",
                          filtro: "revisao_imagem",
                        })}
                        className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-900 hover:bg-violet-200"
                      >
                        {revisao} texto incompleto
                      </Link>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.gabaritoCompleto
                          ? "bg-slate-100 text-slate-700"
                          : "bg-amber-50 text-amber-900 ring-1 ring-amber-200"
                      }`}
                    >
                      Gabarito {p.gabaritoCompleto ? "ok" : "pendente"}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {p.publicada ? "Publicada" : "Rascunho"}
                    </span>
                  </div>
                  {p.bancoIncompleto && p.questoesFaltando.length > 0 && (
                    <p className="mt-1 text-xs text-amber-800">
                      Ausentes: {p.questoesFaltando.slice(0, 10).join(", ")}
                      {p.questoesFaltando.length > 10
                        ? ` (+${p.questoesFaltando.length - 10})`
                        : ""}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={acao.href}>
                    <Button type="button">{acao.label}</Button>
                  </Link>
                  <Link href={hrefAdminProva(p.id)}>
                    <Button type="button" variant="secondary">
                      Abrir
                    </Button>
                  </Link>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      {!carregando && provas.length > 0 && provasFiltradas.length === 0 && (
        <p className="text-center text-sm text-slate-500">
          Nenhuma prova neste filtro.{" "}
          <button
            type="button"
            className="text-teal-700 underline"
            onClick={() => {
              setFiltro("todas");
              setBusca("");
            }}
          >
            Limpar filtros
          </button>
        </p>
      )}
    </div>
  );
}
