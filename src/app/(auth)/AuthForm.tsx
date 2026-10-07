"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { loginAction, registerAction, type AuthState } from "./actions";

export function AuthForm({ mode, registrationOpen }: { mode: "login" | "register"; registrationOpen: boolean }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "login" ? loginAction : registerAction, undefined);
  const [tz, setTz] = useState("UTC");
  useEffect(() => setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"), []);

  return (
    <form action={action} className="space-y-4">
      {mode === "register" && (
        <div>
          <label className="label" htmlFor="name">Name (optional)</label>
          <input className="input" id="name" name="name" autoComplete="name" />
        </div>
      )}
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input
          className="input"
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          minLength={mode === "register" ? 8 : undefined}
        />
      </div>
      {mode === "register" && (
        <div>
          <label className="label" htmlFor="confirm">Confirm password</label>
          <input className="input" id="confirm" name="confirm" type="password" autoComplete="new-password" required />
          <input type="hidden" name="timezone" value={tz} />
        </div>
      )}
      {state?.error && (
        <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">
          {state.error}
        </p>
      )}
      <button className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
      </button>
      <p className="text-center text-sm text-muted">
        {mode === "login" ? (
          registrationOpen ? (
            <>
              New here? <Link className="font-semibold text-primary" href="/register">Create an account</Link>
            </>
          ) : null
        ) : (
          <>
            Have an account? <Link className="font-semibold text-primary" href="/login">Log in</Link>
          </>
        )}
      </p>
    </form>
  );
}
