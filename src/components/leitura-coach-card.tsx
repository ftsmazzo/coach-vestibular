import { Badge, Card } from "@/components/ui";

export function LeituraCoachCard({
  titulo,
  mensagem,
  focos = [],
  pctReferencia,
}: {
  titulo: string;
  mensagem: string;
  focos?: Array<{ label: string; prioridade: string }>;
  pctReferencia?: number | null;
}) {
  return (
    <Card className="border-l-4 border-l-teal-500 bg-gradient-to-r from-teal-50/90 to-white">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
          Leitura do coach
        </p>
        <span className="text-xs text-slate-500">·</span>
        <p className="text-xs font-medium text-slate-700">{titulo}</p>
        {pctReferencia != null && (
          <span className="ml-auto inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
            {pctReferencia}% na última aplicação
          </span>
        )}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-700">{mensagem}</p>
      {focos.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {focos.slice(0, 6).map((f, i) => (
            <Badge key={i} tone={f.prioridade === "alta" ? "danger" : "warning"}>
              {f.label}
            </Badge>
          ))}
        </div>
      )}
    </Card>
  );
}
