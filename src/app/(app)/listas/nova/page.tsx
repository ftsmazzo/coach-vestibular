import { redirect } from "next/navigation";

/** Lista rápida desativada — ver /simulados */
export default function NovaListaRedirectPage() {
  redirect("/simulados");
}
