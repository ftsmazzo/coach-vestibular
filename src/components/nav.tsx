"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Badge } from "./ui";
import { homePathForRole, isAdminArea } from "@/lib/role-routes";

const studentLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/provas", label: "Atividades" },
  { href: "/simulados", label: "Listas" },
  { href: "/plano", label: "Plano" },
  { href: "/quests", label: "Quests" },
  { href: "/analise", label: "Análise" },
  { href: "/comunidade", label: "Comunidade" },
  { href: "/perfil", label: "Perfil" },
];

const adminLinks = [
  { href: "/admin", label: "Painel" },
  { href: "/admin/provas", label: "Banco de provas" },
  { href: "/admin/feedback", label: "Reports" },
  { href: "/admin/sugestoes", label: "Sugestões" },
  { href: "/admin/usuarios", label: "Alunos" },
  { href: "/admin/convites", label: "Convites" },
];

const bottomNavStudent = [
  { href: "/dashboard", label: "Início", short: "Início", icon: "🏠" },
  { href: "/provas", label: "Atividades", short: "Ativ.", icon: "📋" },
  { href: "/simulados", label: "Listas", short: "Listas", icon: "📝" },
  { href: "/plano", label: "Plano", short: "Plano", icon: "📅" },
  { href: "__more__", label: "Mais", short: "Mais", icon: "☰" },
] as const;

const moreStudentLinks = [
  { href: "/quests", label: "Quests", desc: "Tarefas da semana" },
  { href: "/analise", label: "Análise", desc: "Gráficos da jornada" },
  { href: "/comunidade", label: "Comunidade", desc: "Ranking e XP" },
  { href: "/perfil", label: "Perfil", desc: "Meta e conquistas" },
  { href: "/reportar", label: "Reportar erro", desc: "Bug ou sugestão (beta)" },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function linkClass(pathname: string, href: string) {
  const active = isActive(pathname, href);
  return `rounded-lg px-3 py-2 text-sm ${
    active ? "bg-teal-50 font-medium text-teal-800" : "text-slate-600 hover:bg-slate-50"
  }`;
}

export function Nav({ userName, role }: { userName: string; role?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const isAdmin = role === "ADMIN";
  const links = isAdmin ? adminLinks : studentLinks;
  const homeHref = homePathForRole(role);
  const firstName = userName.split(" ")[0];

  useEffect(() => {
    setMenuOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen && !moreOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen, moreOpen]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        {/* Mobile */}
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 md:hidden">
          <Link href={homeHref} className="min-h-11 min-w-11 flex items-center text-base font-semibold text-teal-700">
            Coach
          </Link>
          <div className="flex items-center gap-1">
            {isAdmin && <Badge tone="neutral">Admin</Badge>}
            <span className="max-w-[88px] truncate text-xs text-slate-500">{firstName}</span>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100"
              aria-label="Abrir menu"
            >
              <span className="text-xl leading-none" aria-hidden>
                ☰
              </span>
            </button>
          </div>
        </div>

        {/* Desktop */}
        <div className="mx-auto hidden max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-3 md:flex">
          <div className="flex items-center gap-2">
            <Link href={homeHref} className="text-lg font-semibold text-teal-700">
              Coach Vestibular
            </Link>
            {isAdmin && <Badge tone="neutral">Admin</Badge>}
          </div>
          <nav className="flex flex-wrap items-center gap-1">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className={linkClass(pathname, l.href)}>
                {l.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/provas"
                className={`rounded-lg px-3 py-2 text-sm ${
                  pathname.startsWith("/provas") && !pathname.startsWith("/admin")
                    ? "bg-slate-100 font-medium text-slate-700"
                    : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                Prévia aluno
              </Link>
            )}
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">Olá, {firstName}</span>
            <Button variant="ghost" onClick={logout}>
              Sair
            </Button>
          </div>
        </div>

        {isAdmin && !isAdminArea(pathname) && pathname !== "/provas" && (
          <div className="border-t border-amber-100 bg-amber-50/80 px-3 py-2 text-center text-xs text-amber-900 md:px-4">
            Você está na área do <strong>aluno</strong> (prévia). Cadastro em{" "}
            <Link href="/admin/provas" className="font-medium text-teal-800 underline">
              Banco de provas
            </Link>
            .
          </div>
        )}
      </header>

      {/* Menu mobile (admin ou links extras) */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Fechar menu"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute right-0 top-0 flex h-full w-[min(100%,320px)] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="font-semibold text-slate-900">Menu</p>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3">
              <ul className="space-y-1">
                {links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className={`flex min-h-12 items-center rounded-xl px-4 text-base ${linkClass(pathname, l.href)}`}
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
                {isAdmin && (
                  <li>
                    <Link href="/provas" className={`flex min-h-12 items-center rounded-xl px-4 text-base ${linkClass(pathname, "/provas")}`}>
                      Prévia aluno
                    </Link>
                  </li>
                )}
              </ul>
            </nav>
            <div className="border-t border-slate-100 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <Button variant="secondary" className="w-full min-h-12" onClick={logout}>
                Sair
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Sheet "Mais" — aluno */}
      {moreOpen && !isAdmin && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Mais opções">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Fechar"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 max-h-[75vh] overflow-y-auto rounded-t-2xl bg-white shadow-2xl">
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-200" />
            <p className="px-4 pt-3 text-sm font-semibold text-slate-900">Mais</p>
            <ul className="space-y-1 p-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {moreStudentLinks.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className={`flex min-h-14 flex-col justify-center rounded-xl px-4 ${
                      isActive(pathname, l.href) ? "bg-teal-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <span className="font-medium text-slate-900">{l.label}</span>
                    <span className="text-xs text-slate-500">{l.desc}</span>
                  </Link>
                </li>
              ))}
              <li className="pt-2">
                <Button variant="secondary" className="w-full min-h-12" onClick={logout}>
                  Sair
                </Button>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Bottom nav — aluno */}
      {!isAdmin && (
        <nav
          className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md md:hidden"
          aria-label="Navegação principal"
        >
          <div className="grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
            {bottomNavStudent.map((item) => {
              const isMore = item.href === "__more__";
              const active = !isMore && isActive(pathname, item.href);
              const moreActive = moreStudentLinks.some((l) => isActive(pathname, l.href));

              if (isMore) {
                return (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => setMoreOpen(true)}
                    className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium ${
                      moreActive || moreOpen ? "text-teal-700" : "text-slate-500"
                    }`}
                  >
                    <span className="text-lg leading-none" aria-hidden>
                      {item.icon}
                    </span>
                    {item.short}
                  </button>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium ${
                    active ? "text-teal-700" : "text-slate-500"
                  }`}
                >
                  <span className="text-lg leading-none" aria-hidden>
                    {item.icon}
                  </span>
                  {item.short}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}
