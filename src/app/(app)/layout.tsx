import { BottomNav } from "@/components/BottomNav";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <>
      <main className="pt-safe mx-auto w-full max-w-2xl px-4 pb-28">{children}</main>
      <BottomNav />
    </>
  );
}
