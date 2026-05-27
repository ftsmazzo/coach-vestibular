import Link from "next/link";
import type { FiltroRegistros } from "@/lib/prova-tipo";

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition sm:min-h-0 ${
        active
          ? "bg-teal-600 text-white shadow-sm"
          : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
      }`}
    >
      {children}
    </Link>
  );
}

export function FiltroRegistrosTabs({
  basePath,
  filtro,
  counts,
}: {
  basePath: string;
  filtro: FiltroRegistros;
  counts: { todos: number; provas: number; simulados: number };
}) {
  const q = (f: FiltroRegistros) => (f === "todos" ? basePath : `${basePath}?filtro=${f}`);

  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      <TabLink href={q("todos")} active={filtro === "todos"}>
        Todos ({counts.todos})
      </TabLink>
      <TabLink href={q("provas")} active={filtro === "provas"}>
        Provas oficiais ({counts.provas})
      </TabLink>
      <TabLink href={q("simulados")} active={filtro === "simulados"}>
        Simulados ({counts.simulados})
      </TabLink>
    </div>
  );
}
