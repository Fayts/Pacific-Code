import Link from "next/link";
import { Waves } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-4 py-10 bg-neutral-50">
      <Link
        href="/"
        className="mb-8 flex items-center gap-2 text-neutral-900"
      >
        <span className="flex size-9 items-center justify-center rounded-lg bg-sky-700 text-white">
          <Waves className="size-5" aria-hidden />
        </span>
        <span className="text-xl font-semibold tracking-tight">
          Pacific Code
        </span>
      </Link>
      <div className="w-full max-w-md">{children}</div>
      <p className="mt-8 text-xs text-neutral-500">
        Gestion de location simple et fiable
      </p>
    </div>
  );
}
