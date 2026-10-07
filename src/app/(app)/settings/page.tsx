import Link from "next/link";
import { ChevronRight, Download, FileUp, History, Image as ImageIcon, LogOut } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { ensureDeck } from "@/lib/userSetup";
import { DEMO_SOURCE } from "@/lib/demoData";
import { PageHeader } from "@/components/PageHeader";
import { logoutAction } from "../../(auth)/actions";
import { SettingsForm } from "./SettingsForm";
import { ThemePicker } from "./ThemePicker";
import { RemoveDemoButton } from "./RemoveDemoButton";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const settings = await getSettings(user.id);
  const deck = await ensureDeck(prisma, user.id);
  const demoCount = await prisma.card.count({ where: { deckId: deck.id, source: DEMO_SOURCE } });

  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-5">
        <SettingsForm
          initial={{
            newCardsPerDay: settings.newCardsPerDay,
            maxReviewsPerDay: settings.maxReviewsPerDay,
            autoShowAnswerSeconds: settings.autoShowAnswerSeconds,
            randomizeNewCards: settings.randomizeNewCards,
            desiredRetention: settings.desiredRetention,
            examDate: settings.examDate ? settings.examDate.toISOString().slice(0, 10) : "",
            timezone: settings.timezone,
          }}
        />

        <section>
          <p className="section-title">Appearance</p>
          <div className="panel p-3">
            <ThemePicker initial={settings.theme} />
          </div>
        </section>

        <section>
          <p className="section-title">Import</p>
          <div className="panel divide-y divide-border overflow-hidden">
            <NavRow href="/settings/import" icon={<FileUp className="size-5 text-primary" />} label="Import cards" hint="CSV, TSV, Anki text export or .apkg" />
            <NavRow href="/settings/import/history" icon={<History className="size-5 text-primary" />} label="Import history" />
            <NavRow href="/settings/media" icon={<ImageIcon className="size-5 text-primary" />} label="Card images" hint="Upload images referenced by cards" />
          </div>
        </section>

        <section>
          <p className="section-title">Data</p>
          <div className="panel divide-y divide-border overflow-hidden">
            <a href="/api/export?format=json" className="flex min-h-14 items-center gap-3 px-4 py-3">
              <Download className="size-5 text-primary" />
              <span className="flex-1">
                <span className="block font-medium">Export everything (JSON)</span>
                <span className="block text-xs text-muted">Cards, day assignments, review history, settings</span>
              </span>
            </a>
            <a href="/api/export?format=csv" className="flex min-h-14 items-center gap-3 px-4 py-3">
              <Download className="size-5 text-primary" />
              <span className="flex-1">
                <span className="block font-medium">Export cards + progress (CSV)</span>
                <span className="block text-xs text-muted">Opens in Excel / Google Sheets</span>
              </span>
            </a>
            {demoCount > 0 && <RemoveDemoButton count={demoCount} />}
          </div>
        </section>

        <section>
          <p className="section-title">Account</p>
          <div className="panel divide-y divide-border overflow-hidden">
            <div className="px-4 py-3">
              <p className="text-xs text-muted">Signed in as</p>
              <p className="font-medium">{user.email}</p>
            </div>
            <form action={logoutAction}>
              <button className="flex min-h-14 w-full items-center gap-3 px-4 text-left font-medium text-danger">
                <LogOut className="size-5" /> Log out
              </button>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}

function NavRow({ href, icon, label, hint }: { href: string; icon: React.ReactNode; label: string; hint?: string }) {
  return (
    <Link href={href} className="flex min-h-14 items-center gap-3 px-4 py-3">
      {icon}
      <span className="flex-1">
        <span className="block font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <ChevronRight className="size-5 text-muted" />
    </Link>
  );
}
