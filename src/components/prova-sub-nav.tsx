import Link from "next/link";
import { linkTouchChipClass } from "@/components/ui";

export type ProvaSubNavAba = "lente" | "historico" | "registrar";

export function ProvaSubNav({
  provaId,
  active,
}: {
  provaId: string;
  active: ProvaSubNavAba;
}) {
  const tabs: { id: ProvaSubNavAba; href: string; label: string }[] = [
    { id: "lente", href: `/provas/${provaId}/lente`, label: "Lente" },
    { id: "historico", href: `/provas/${provaId}/historico`, label: "Histórico" },
    {
      id: "registrar",
      href: `/simulados/novo?provaId=${provaId}`,
      label: "Registrar",
    },
  ];

  return (
    <nav
      className="-mx-1 flex gap-2 overflow-x-auto pb-1 scrollbar-none"
      aria-label="Navegação desta prova"
    >
      {tabs.map((t) => (
        <Link key={t.id} href={t.href} className={linkTouchChipClass(active === t.id)}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
