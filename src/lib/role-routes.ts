export type AppRole = "STUDENT" | "ADMIN";

export function homePathForRole(role: AppRole | string | undefined): string {
  return role === "ADMIN" ? "/admin" : "/dashboard";
}

export function isAdminArea(pathname: string): boolean {
  return pathname.startsWith("/admin");
}
