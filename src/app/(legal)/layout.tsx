import Link from "next/link";
import { getLegalInfo, hasPlaceholders } from "@/config/legal";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  const missing = hasPlaceholders(getLegalInfo());
  return (
    <>
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-3">
          <Link href="/" className="font-semibold">W-Seminar-Helfer</Link>
          <nav className="flex gap-3 text-sm">
            <Link href="/impressum" className="underline">Impressum</Link>
            <Link href="/datenschutz" className="underline">Datenschutz</Link>
          </nav>
        </div>
      </header>
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        {missing && (
          <p role="alert" className="mb-5 rounded border border-red-300 bg-red-50 p-3 text-red-900">
            Achtung: Die Betreiberangaben sind noch nicht vollständig (siehe „[BITTE AUSFÜLLEN]“). Diese Seite darf so nicht online gehen.
          </p>
        )}
        {children}
      </div>
    </>
  );
}
