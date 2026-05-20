"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "./ui";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/simulados", label: "Simulados" },
  { href: "/plano", label: "Plano" },
  { href: "/quests", label: "Quests" },
];

export function Nav({ userName, role }: { userName: string; role?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-3">
        <Link href="/dashboard" className="text-lg font-semibold text-teal-700">
          Coach Vestibular
        </Link>
        <nav className="flex flex-wrap gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                pathname.startsWith(l.href)
                  ? "bg-teal-50 font-medium text-teal-800"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {l.label}
            </Link>
          ))}
          {role === "ADMIN" && (
            <Link
              href="/admin/convites"
              className={`rounded-lg px-3 py-1.5 text-sm ${
                pathname.startsWith("/admin")
                  ? "bg-teal-50 font-medium text-teal-800"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              Convites
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
    </header>
  );
}
