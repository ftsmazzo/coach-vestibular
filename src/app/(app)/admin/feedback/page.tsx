import Link from "next/link";
import { AdminFeedbackLista } from "@/components/admin-feedback-lista";

export default function AdminFeedbackPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-sm text-teal-700 hover:underline">
          ← Painel admin
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Reports e sugestões</h1>
        <p className="mt-1 text-slate-600">
          Erros, sugestões e dúvidas enviados pelos alunos em <span className="font-medium">/reportar</span>.
          Cada item traz o contexto técnico (página, navegador, versão) para resolver rápido.
        </p>
      </div>
      <AdminFeedbackLista />
    </div>
  );
}
