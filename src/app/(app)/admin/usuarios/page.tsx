"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Button, Input, Label, Badge } from "@/components/ui";

interface Aluno {
  id: string;
  name: string;
  email: string;
  vestibularAlvo: string | null;
  metaProva: string | null;
  createdAt: string;
  registrosProva: number;
}

export default function AdminUsuariosPage() {
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [error, setError] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [senhaGerada, setSenhaGerada] = useState<string | null>(null);
  const [zerandoId, setZerandoId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    vestibularAlvo: "Medicina",
    metaProva: "",
  });

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      setAlunos(await res.json());
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function criarConta(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setError("");
    setSucesso("");
    setSenhaGerada(null);

    const body: Record<string, string> = {
      name: form.name,
      email: form.email,
      vestibularAlvo: form.vestibularAlvo,
    };
    if (form.metaProva.trim()) body.metaProva = form.metaProva.trim();
    if (form.password.trim()) body.password = form.password.trim();

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSalvando(false);

    if (!res.ok) {
      setError(data.error ?? "Erro ao criar conta");
      return;
    }

    setSucesso(data.mensagem ?? "Conta criada.");
    if (data.senhaInicial) setSenhaGerada(data.senhaInicial);
    setForm({
      name: "",
      email: "",
      password: "",
      vestibularAlvo: "Medicina",
      metaProva: "",
    });
    load();
  }

  async function zerarCopiloto(aluno: Aluno) {
    if (
      !confirm(
        `Zerar copiloto de ${aluno.name}?\n\n` +
          "Remove TODOS os planos e quests (incluindo concluídas) e gera novos a partir dos registros de prova atuais.\n" +
          "Mantém: conta, provas cadastradas, gabaritos e respostas.\n\n" +
          "Continuar?"
      )
    ) {
      return;
    }
    const incluirAnamnese = confirm(
      "Apagar também a anamnese (Entendendo sua jornada)?\n\n" +
        "OK = sim, o banner volta na Home para refazer.\n" +
        "Cancelar = mantém a anamnese já feita."
    );

    setZerandoId(aluno.id);
    setError("");
    setSucesso("");
    const res = await fetch(`/api/admin/users/${aluno.id}/zerar-copiloto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ incluirAnamnese }),
    });
    const data = await res.json();
    setZerandoId(null);

    if (!res.ok) {
      setError(data.error ?? "Erro ao zerar copiloto");
      return;
    }
    const detalhe =
      data.planoGeradoEm != null
        ? ` Gerado em ${new Date(data.planoGeradoEm).toLocaleString("pt-BR")}.`
        : "";
    setSucesso((data.mensagem ?? "Copiloto recriado.") + detalhe);
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin" className="text-sm text-teal-700 hover:underline">
          ← Painel admin
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Alunos e acesso</h1>
        <p className="mt-1 text-slate-600">
          Crie contas com nome e e-mail reais. Repasse a senha ao aluno (ou defina uma senha
          agora). Para cadastro público, use{" "}
          <Link href="/admin/convites" className="font-medium text-teal-700 hover:underline">
            convites
          </Link>
          .
        </p>
      </div>

      <Card className="border-teal-100 bg-teal-50/30">
        <h2 className="font-semibold text-slate-900">Nova conta de aluno</h2>
        <form onSubmit={criarConta} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Nome completo</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Maria Silva"
              required
            />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="maria@email.com"
              required
            />
          </div>
          <div>
            <Label>Senha inicial (opcional)</Label>
            <Input
              type="text"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Deixe vazio para gerar automaticamente"
              minLength={6}
            />
            <p className="mt-1 text-xs text-slate-500">Mínimo 6 caracteres se preencher.</p>
          </div>
          <div>
            <Label>Vestibular alvo</Label>
            <Input
              value={form.vestibularAlvo}
              onChange={(e) => setForm({ ...form, vestibularAlvo: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Meta / observação (opcional)</Label>
            <Input
              value={form.metaProva}
              onChange={(e) => setForm({ ...form, metaProva: e.target.value })}
              placeholder="Ex.: ENEM 2026, Medicina UFU"
            />
          </div>
          <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={salvando}>
              {salvando ? "Criando..." : "Criar conta"}
            </Button>
          </div>
        </form>

        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        {sucesso && <p className="mt-3 text-sm text-teal-800">{sucesso}</p>}
        {senhaGerada && (
          <Card className="mt-4 border-amber-200 bg-amber-50">
            <p className="text-sm font-medium text-amber-950">Senha inicial (copie agora)</p>
            <p className="mt-2 font-mono text-lg tracking-wide text-slate-900">{senhaGerada}</p>
            <p className="mt-2 text-xs text-amber-900">
              O aluno entra em <strong>/login</strong> com o e-mail cadastrado e esta senha.
            </p>
          </Card>
        )}
      </Card>

      <section>
        <h2 className="mb-3 font-semibold text-slate-900">
          Alunos cadastrados ({alunos.length})
        </h2>
        {loading ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : alunos.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-600">Nenhum aluno ainda.</p>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-slate-600">
                  <th className="p-3 font-medium">Nome</th>
                  <th className="p-3 font-medium">E-mail</th>
                  <th className="p-3 font-medium">Meta</th>
                  <th className="p-3 font-medium text-center">Provas</th>
                  <th className="p-3 font-medium">Desde</th>
                  <th className="p-3 font-medium">Copiloto</th>
                </tr>
              </thead>
              <tbody>
                {alunos.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100">
                    <td className="p-3 font-medium text-slate-900">{a.name}</td>
                    <td className="p-3 text-slate-700">{a.email}</td>
                    <td className="p-3 text-slate-600">
                      {[a.vestibularAlvo, a.metaProva].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="p-3 text-center">
                      {a.registrosProva > 0 ? (
                        <Badge tone="success">{a.registrosProva}</Badge>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="p-3 text-slate-500 whitespace-nowrap">
                      {new Date(a.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="p-3">
                      <Button
                        type="button"
                        variant="secondary"
                        className="text-xs"
                        disabled={zerandoId === a.id}
                        onClick={() => zerarCopiloto(a)}
                      >
                        {zerandoId === a.id ? "Recriando…" : "Zerar e recriar"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
