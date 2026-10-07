import { WifiOff } from "lucide-react";

export const metadata = { title: "Offline" };
export const dynamic = "force-static";

export default function Offline() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-6 text-center">
      <WifiOff className="size-12 text-muted" />
      <h1 className="mt-4 text-2xl font-bold">You&apos;re offline</h1>
      <p className="mt-2 text-muted">Reconnect to keep studying — your progress is saved on the server.</p>
      <a href="/" className="btn btn-primary mt-6 w-full">Try again</a>
    </main>
  );
}
