"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button, Badge } from "./ui";
import { homePathForRole, isAdminArea } from "@/lib/role-routes";

const studentLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/provas", label: "Provas públicas" },
  { href: "/simulados", label: "Resultados" },
  { href: "/plano", label: "Plano" },
  { href: "/quests", label: "Quests" },
];

const adminLinks = [
  { href: "/admin", label: "Painel" },
  { href: "/admin/provas", label: "Banco de provas" },
  { href: "/admin/sugestoes", label: "Sugestões" },
  { href: "/admin/usuarios", label: "Alunos" },
  { href: "/admin/convites", label: "Convites" },
];

export function Nav({ userName, role }: { userName: string; role?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = role === "ADMIN";
  const links = isAdmin ? adminLinks : studentLinks;
  const homeHref = homePathForRole(role);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function linkClass(href: string) {
    const active =
      href === "/admin"
        ? pathname === "/admin"
        : pathname.startsWith(href);
    return `rounded-lg px-3 py-1.5 text-sm ${
      active ? "bg-teal-50 font-medium text-teal-800" : "text-slate-600 hover:bg-slate-50"
    }`;
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-2">
          <Link href={homeHref} className="text-lg font-semibold text-teal-700">
            Coach Vestibular
          </Link>
          {isAdmin && <Badge tone="neutral">Admin</Badge>}
        </div>
        <nav className="flex flex-wrap items-center gap-1">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass(l.href)}>
              {l.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/provas"
              className={`rounded-lg px-3 py-1.5 text-sm ${
                pathname.startsWith("/provas") &&
                !pathname.startsWith("/admin")
                  ? "bg-slate-100 font-medium text-slate-700"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
              title="Ver o catálogo que o aluno vê"
            >
              Prévia aluno
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">Olá, {userName}</span>
          <Button variant="ghost" onClick={logout}>
            Sair
          </Button>
        </div>
      </div>
      {isAdmin && !isAdminArea(pathname) && pathname !== "/provas" && (
        <div className="border-t border-amber-100 bg-amber-50/80 px-4 py-2 text-center text-xs text-amber-900">
          Você está na área do <strong>aluno</strong> (prévia). Cadastro de provas fica em{" "}
          <Link href="/admin/provas" className="font-medium text-teal-800 underline">
            Banco de provas
          </Link>
          .
        </div>
      )}
    </header>
  );
}
