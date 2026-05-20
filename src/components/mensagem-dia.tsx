import { getMensagemDoDia } from "@/lib/mensagem-dia";

export function MensagemDiaCard() {
  const { texto, referencia } = getMensagemDoDia();

  return (
    <aside
      className="rounded-2xl border border-amber-100/80 bg-gradient-to-r from-amber-50/90 via-white to-teal-50/50 px-5 py-4 shadow-sm"
      aria-label="Mensagem do dia"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800/90">
        Mensagem do dia
      </p>
      <blockquote className="mt-2 text-base font-medium leading-relaxed text-slate-800">
        “{texto}”
      </blockquote>
      <p className="mt-2 text-sm font-medium text-teal-800">{referencia}</p>
    </aside>
  );
}
