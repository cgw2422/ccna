import { Layers } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="pt-safe mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-fg">
          <Layers className="size-7" />
        </div>
        <h1 className="text-2xl font-bold">CCNA Cards</h1>
        <p className="mt-1 text-sm text-muted">Jeremy&apos;s IT Lab flashcards, organized by study day</p>
      </div>
      {children}
    </main>
  );
}
