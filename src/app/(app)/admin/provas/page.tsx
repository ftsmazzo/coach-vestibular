"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { buildProvaNome } from "@/lib/prova-nome";

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
  _count: { questoes: number; tentativas: number };
}

export default function AdminProvasPage() {
  const [provas, setProvas] = useState<Prova[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Banco de provas</h1>
        <p className="text-slate-600">
          Primeiro cadastre a prova (vestibular, ano, caderno). Depois importe ou extraia as questões
          (matéria, assunto, conhecimento).
        </p>
      </div>

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

      {carregando && (
        <p className="text-sm text-slate-500">Carregando banco de provas…</p>
      )}

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
          <ul className="mt-3 list-inside list-disc text-sm text-amber-900">
            <li>
              Se você cadastrou antes: o Postgres no EasyPanel provavelmente{" "}
              <strong>não tem volume persistente</strong> — dados somem ao reiniciar o serviço.
            </li>
            <li>
              Confira se <code className="text-xs">CONFIRMAR_RESET</code> não está{" "}
              <code className="text-xs">true</code> nas variáveis de ambiente.
            </li>
            <li>
              PDFs da prova ficam em <code className="text-xs">data/uploads</code> — monte volume
              persistente no app também.
            </li>
          </ul>
          <p className="mt-3 text-sm text-amber-800">
            Crie a prova de novo abaixo. Depois configure volume no Postgres antes de perder dados
            outra vez.
          </p>
        </Card>
      )}

      <ul className="space-y-3">
        {provas.map((p) => (
          <li key={p.id}>
            <Card className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">{p.nome}</h3>
                <p className="text-sm text-slate-500">
                  <span className={p.bancoIncompleto ? "font-medium text-amber-700" : ""}>
                    {p.questoesCadastradas} de {p.totalQuestoes} questões no banco
                  </span>
                  {p.bancoIncompleto && p.questoesFaltando.length > 0 && (
                    <span className="block text-xs text-amber-700">
                      Faltam no banco: nº{" "}
                      {p.questoesFaltando.slice(0, 12).join(", ")}
                      {p.questoesFaltando.length > 12
                        ? ` (+${p.questoesFaltando.length - 12})`
                        : ""}
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  {p.publicada ? "Publicada" : "Rascunho"} · Gabarito{" "}
                  {p.gabaritoCompleto ? "completo" : "incompleto"}
                </p>
              </div>
              <Link href={`/admin/provas/${p.id}`}>
                <Button variant="secondary">Gerenciar questões</Button>
              </Link>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
