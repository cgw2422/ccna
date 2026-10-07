import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-bold">Not found</h1>
      <p className="mt-2 text-muted">That page doesn&apos;t exist.</p>
      <Link href="/" className="btn btn-primary mt-6 w-full">Go home</Link>
    </main>
  );
}
