import Link from "next/link";
import { AdminEnemCorpusPanel } from "@/components/admin-enem-corpus-panel";

export default function AdminEnemCorpusPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-sm text-teal-700 hover:underline">
          ← Painel admin
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Corpus ENEM &amp; catálogo</h1>
        <p className="mt-1 text-slate-600">
          Snapshot estrutural enem.dev (2009–2023), validação do catálogo Biologia e classificação
          piloto N1/N2. O aluno não vê esta área.
        </p>
      </div>
      <AdminEnemCorpusPanel />
    </div>
  );
}
