import Link from "next/link";

export function PageBackLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center text-sm font-medium text-teal-700 hover:underline"
    >
      ← {children}
    </Link>
  );
}
