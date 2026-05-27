import { calcularConquistas } from "@/lib/conquistas";
import { Card } from "@/components/ui";

export async function ConquistasGrid({ userId }: { userId: string }) {
  const conquistas = await calcularConquistas(userId);
  const desbloqueadas = conquistas.filter((c) => c.desbloqueada);

  return (
    <Card>
      <h2 className="font-semibold text-slate-900">Conquistas</h2>
      <p className="mt-1 text-sm text-slate-600">
        {desbloqueadas.length} de {conquistas.length} desbloqueadas
      </p>
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {conquistas.map((c) => (
          <li
            key={c.id}
            className={`rounded-xl border p-3 ${
              c.desbloqueada
                ? "border-amber-200 bg-amber-50/80"
                : "border-slate-100 bg-slate-50/50 opacity-80"
            }`}
          >
            <div className="flex gap-2">
              <span className="text-2xl" aria-hidden>
                {c.emoji}
              </span>
              <div>
                <p className="font-medium text-slate-900">{c.titulo}</p>
                <p className="text-xs text-slate-600">{c.descricao}</p>
                {!c.desbloqueada && c.progresso && (
                  <p className="mt-1 text-xs text-slate-500">{c.progresso}</p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
