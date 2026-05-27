import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Nav } from "@/components/nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50">
      <Nav userName={session.name} role={session.role} />
      <main className="app-main mx-auto max-w-5xl px-3 py-5 sm:px-4 sm:py-8">{children}</main>
    </div>
  );
}
