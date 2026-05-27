import Link from "next/link";
import { AdminSugestoesLista } from "@/components/admin-sugestoes-lista";

export default function AdminSugestoesPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-sm text-teal-700 hover:underline">
          ← Painel admin
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Sugestões de classificação</h1>
        <p className="mt-1 text-slate-600">
          Revisão colaborativa — alunos ajudam a corrigir matéria e assunto das questões.
        </p>
      </div>
      <AdminSugestoesLista />
    </div>
  );
}
