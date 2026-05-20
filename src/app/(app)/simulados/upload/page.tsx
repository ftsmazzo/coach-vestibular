"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Input, Label } from "@/components/ui";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    setResult(data);
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Upload de prova (Fase 2)</h1>
      <Card>
        <p className="mb-4 text-sm text-slate-600">
          Envie PDF ou foto da prova. A extração automática com OCR e IA será ativada na Fase 2.
          Por enquanto, o sistema confirma o recebimento e orienta o registro manual ou CSV.
        </p>
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <Label>Arquivo (PDF, JPG, PNG)</Label>
            <Input
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button type="submit" disabled={!file || loading}>
            {loading ? "Enviando..." : "Enviar"}
          </Button>
        </form>
        {result && (
          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">
            <pre className="whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
        <Link href="/simulados/novo" className="mt-4 inline-block text-sm text-teal-700 hover:underline">
          → Registrar gabarito manualmente
        </Link>
      </Card>
    </div>
  );
}
