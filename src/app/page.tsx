import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { homePathForRole } from "@/lib/role-routes";

export default async function Home() {
  const session = await getSession();
  redirect(session ? homePathForRole(session.role) : "/login");
}
