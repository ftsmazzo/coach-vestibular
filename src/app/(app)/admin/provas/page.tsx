"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Card, Input, Label, Select } from "@/components/ui";

interface Prova {
  id: string;
  nome: string;
  banca: string;
  tipo: string;
  totalQuestoes: number;
  publicada: boolean;
  gabaritoCompleto: boolean;
  _count: { questoes: number; tentativas: number };
}

export default function AdminProvasPage() {
  const [provas, setProvas] = useState<Prova[]>([]);
  const [form, setForm] = useState({
    nome: "",
    banca: "ENEM",
    tipo: "SIMULADO",
    totalQuestoes: 60,
  });

  async function load() {
    const res = await fetch("/api/admin/provas");
    if (res.ok) setProvas(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/provas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ nome: "", banca: "ENEM", tipo: "SIMULADO", totalQuestoes: 60 });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Banco de provas (Admin)</h1>
        <p className="text-slate-600">
          Cadastre a prova com uma linha por questão: matéria, assunto, conhecimento e gabarito
          (pode preencher depois).
        </p>
      </div>

      <Card>
        <h2 className="mb-4 font-semibold">Nova prova</h2>
        <form onSubmit={criar} className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Nome</Label>
            <Input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="ENEM 2024 — 1º dia Natureza"
              required
            />
          </div>
          <div>
            <Label>Banca</Label>
            <Input value={form.banca} onChange={(e) => setForm({ ...form, banca: e.target.value })} />
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

      <ul className="space-y-3">
        {provas.map((p) => (
          <li key={p.id}>
            <Card className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">{p.nome}</h3>
                <p className="text-sm text-slate-500">
                  {p.banca} · {p.tipo} · {p._count.questoes}/{p.totalQuestoes} questões ·{" "}
                  {p._count.tentativas} tentativas
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
