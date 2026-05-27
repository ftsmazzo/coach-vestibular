"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apelidoRankingAutomatico } from "@/lib/apelido-ranking";
import { formatarTelefoneExibicao } from "@/lib/telefone";
import { Button, Card, Input, Label } from "@/components/ui";

export type PerfilInicial = {
  name: string;
  email: string;
  telefone: string | null;
  nomeExibicaoRanking: string | null;
  vestibularAlvo: string;
  metaProva: string;
};

export function PerfilEditarForm({ inicial }: { inicial: PerfilInicial }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: inicial.name,
    email: inicial.email,
    telefone: inicial.telefone ? formatarTelefoneExibicao(inicial.telefone) : "",
    nomeExibicaoRanking: inicial.nomeExibicaoRanking ?? "",
    vestibularAlvo: inicial.vestibularAlvo,
    metaProva: inicial.metaProva,
    senhaAtual: "",
    senhaNova: "",
    senhaNova2: "",
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");

  const previewRanking =
    form.nomeExibicaoRanking.trim() ||
    apelidoRankingAutomatico(form.name || inicial.name);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro("");
    setMsg("");

    if (form.senhaNova || form.senhaNova2) {
      if (form.senhaNova !== form.senhaNova2) {
        setErro("As senhas novas não coincidem");
        setLoading(false);
        return;
      }
      if (!form.senhaAtual) {
        setErro("Informe a senha atual para alterar a senha");
        setLoading(false);
        return;
      }
    }

    const body: Record<string, string> = {
      name: form.name,
      email: form.email,
      telefone: form.telefone,
      nomeExibicaoRanking: form.nomeExibicaoRanking,
      vestibularAlvo: form.vestibularAlvo,
      metaProva: form.metaProva,
    };
    if (form.senhaNova) {
      body.senhaAtual = form.senhaAtual;
      body.senhaNova = form.senhaNova;
    }

    const res = await fetch("/api/me/perfil", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setErro(data.error ?? "Erro ao salvar");
      return;
    }

    setMsg(data.mensagem ?? "Perfil atualizado.");
    setForm((f) => ({ ...f, senhaAtual: "", senhaNova: "", senhaNova2: "" }));
    router.refresh();
  }

  return (
    <form onSubmit={salvar} className="space-y-6">
      <Card>
        <h2 className="font-semibold text-slate-900">Seus dados</h2>
        <p className="mt-1 text-xs text-slate-500">
          E-mail e telefone para login e, no futuro, avisos por WhatsApp.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Nome completo</Label>
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <p className="mt-1 text-xs text-slate-500">Só você e a equipe veem o nome real.</p>
          </div>
          <div>
            <Label>E-mail</Label>
            <Input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <Label>Telefone (WhatsApp)</Label>
            <Input
              type="tel"
              placeholder="(34) 99999-9999"
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
            />
          </div>
        </div>
      </Card>

      <Card className="border-violet-200 bg-violet-50/30">
        <h2 className="font-semibold text-violet-950">Nome no ranking</h2>
        <p className="mt-1 text-xs text-violet-800">
          Escolha como quer aparecer na comunidade — pode ser um apelido (ex.: Estudante Lua, Med
          2026). Deixe em branco para gerar um apelido automático discreto.
        </p>
        <div className="mt-4">
          <Label>Nome de exibição</Label>
          <Input
            value={form.nomeExibicaoRanking}
            onChange={(e) => setForm({ ...form, nomeExibicaoRanking: e.target.value })}
            placeholder="Ex.: Estudante E, Coach Anônimo"
            maxLength={24}
          />
          <p className="mt-2 text-sm text-violet-900">
            Prévia no ranking: <strong>{previewRanking}</strong>
          </p>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold text-slate-900">Meta de vestibular</h2>
        <p className="mt-1 text-xs text-slate-500">
          Usada para priorizar erros da banca da sua meta no plano.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Curso / vestibular alvo</Label>
            <Input
              value={form.vestibularAlvo}
              onChange={(e) => setForm({ ...form, vestibularAlvo: e.target.value })}
            />
          </div>
          <div>
            <Label>Prova ou banca meta</Label>
            <Input
              value={form.metaProva}
              onChange={(e) => setForm({ ...form, metaProva: e.target.value })}
              placeholder="ENEM 2026, UFU..."
            />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold text-slate-900">Alterar senha</h2>
        <p className="mt-1 text-xs text-slate-500">Deixe em branco se não quiser mudar.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Senha atual</Label>
            <Input
              type="password"
              autoComplete="current-password"
              value={form.senhaAtual}
              onChange={(e) => setForm({ ...form, senhaAtual: e.target.value })}
            />
          </div>
          <div>
            <Label>Nova senha</Label>
            <Input
              type="password"
              autoComplete="new-password"
              value={form.senhaNova}
              onChange={(e) => setForm({ ...form, senhaNova: e.target.value })}
            />
          </div>
          <div>
            <Label>Confirmar nova senha</Label>
            <Input
              type="password"
              autoComplete="new-password"
              value={form.senhaNova2}
              onChange={(e) => setForm({ ...form, senhaNova2: e.target.value })}
            />
          </div>
        </div>
      </Card>

      {erro && <p className="text-sm text-rose-600">{erro}</p>}
      {msg && <p className="text-sm text-teal-700">{msg}</p>}

      <Button type="submit" disabled={loading}>
        {loading ? "Salvando..." : "Salvar alterações"}
      </Button>
    </form>
  );
}
