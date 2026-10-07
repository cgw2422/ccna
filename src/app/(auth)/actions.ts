"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  checkLoginThrottle,
  clearLoginFailures,
  createSession,
  destroySession,
  hashPassword,
  recordLoginFailure,
  registrationOpen,
  verifyPassword,
} from "@/lib/auth";
import { createUserWithDefaults } from "@/lib/userSetup";
import { safeTimeZone } from "@/lib/time";

export type AuthState = { error?: string } | undefined;

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export async function loginAction(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = `${ip}:${parsed.data.email}`;
  if (!checkLoginThrottle(key)) return { error: "Too many attempts. Try again in 15 minutes." };

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  // Always run bcrypt to keep timing similar for unknown emails.
  const ok = await verifyPassword(parsed.data.password, user?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva");
  if (!user || !ok) {
    recordLoginFailure(key);
    return { error: "Incorrect email or password" };
  }
  clearLoginFailures(key);
  await createSession(user.id);
  redirect("/");
}

const registration = z
  .object({
    email: z.string().trim().toLowerCase().email("Enter a valid email"),
    password: z.string().min(8, "Password must be at least 8 characters").max(200),
    confirm: z.string(),
    name: z.string().trim().max(80).optional(),
    timezone: z.string().optional(),
  })
  .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ["confirm"] });

export async function registerAction(_: AuthState, form: FormData): Promise<AuthState> {
  if (!(await registrationOpen())) return { error: "Registration is closed." };
  const parsed = registration.safeParse({
    email: form.get("email"),
    password: form.get("password"),
    confirm: form.get("confirm"),
    name: form.get("name") || undefined,
    timezone: form.get("timezone") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const exists = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (exists) return { error: "An account with that email already exists" };
  const user = await createUserWithDefaults(prisma, {
    email: parsed.data.email,
    passwordHash: await hashPassword(parsed.data.password),
    name: parsed.data.name,
    timezone: safeTimeZone(parsed.data.timezone),
    withDemo: true,
  });
  await createSession(user.id);
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
