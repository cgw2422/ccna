import { redirect } from "next/navigation";
import { getCurrentUser, registrationOpen } from "@/lib/auth";
import { AuthForm } from "../AuthForm";

export const metadata = { title: "Log in" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  const open = await registrationOpen();
  return (
    <div className="panel p-5">
      <AuthForm mode="login" registrationOpen={open} />
    </div>
  );
}
