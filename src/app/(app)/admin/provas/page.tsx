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
  const [form, setForm] = useState({
    banca: "ENEM",
    tipo: "SIMULADO",
    ano: "" as string | number,
    dia: "" as string | number,
    caderno: "",
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
