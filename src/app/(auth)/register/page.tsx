import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, registrationOpen } from "@/lib/auth";
import { AuthForm } from "../AuthForm";

export const metadata = { title: "Create account" };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/");
  if (!(await registrationOpen())) {
    return (
      <div className="panel p-5 text-center">
        <p className="font-semibold">Registration is closed</p>
        <p className="mt-1 text-sm text-muted">Set ALLOW_REGISTRATION=true to allow new accounts.</p>
        <Link href="/login" className="btn btn-secondary mt-4 w-full">Back to log in</Link>
      </div>
    );
  }
  return (
    <div className="panel p-5">
      <AuthForm mode="register" registrationOpen />
    </div>
  );
}
