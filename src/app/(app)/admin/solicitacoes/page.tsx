import Link from "next/link";
import { AdminSolicitacoesLista } from "@/components/admin-solicitacoes-lista";

export default function AdminSolicitacoesPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-sm text-teal-700 hover:underline">
          ← Painel admin
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Solicitações de PDF</h1>
        <p className="mt-1 text-slate-600">
          Alunos enviam simulados em{" "}
          <span className="font-medium">Atividades → Solicitar publicação</span> ou em{" "}
          <span className="font-medium">/listas/solicitar</span>. Baixe o material, cadastre em
          Banco de provas e marque como processada.
        </p>
      </div>
      <AdminSolicitacoesLista />
    </div>
  );
}
