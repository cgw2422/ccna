"use client";

import { useState, useTransition } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { setTheme } from "./actions";

type Theme = "SYSTEM" | "LIGHT" | "DARK";

export function ThemePicker({ initial }: { initial: Theme }) {
  const [theme, setLocal] = useState<Theme>(initial);
  const [, start] = useTransition();
  function choose(t: Theme) {
    setLocal(t);
    document.cookie = `theme=${t.toLowerCase()}; path=/; max-age=${60 * 60 * 24 * 400}; samesite=lax`;
    (window as unknown as { __applyTheme?: () => void }).__applyTheme?.();
    start(() => setTheme(t));
  }
  const opts: { v: Theme; label: string; icon: React.ReactNode }[] = [
    { v: "SYSTEM", label: "System", icon: <Monitor className="size-5" /> },
    { v: "LIGHT", label: "Light", icon: <Sun className="size-5" /> },
    { v: "DARK", label: "Dark", icon: <Moon className="size-5" /> },
  ];
  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
      {opts.map((o) => (
        <button
          key={o.v}
          role="radio"
          aria-checked={theme === o.v}
          onClick={() => choose(o.v)}
          className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-sm font-semibold ${
            theme === o.v ? "bg-primary-soft text-primary ring-2 ring-primary" : "bg-surface-2 text-muted"
          }`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
