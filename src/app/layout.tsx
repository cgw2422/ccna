import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: { default: "CCNA Cards", template: "%s · CCNA Cards" },
  description: "Spaced-repetition CCNA flashcards organized by Jeremy's IT Lab study days.",
  applicationName: "CCNA Cards",
  appleWebApp: { capable: true, title: "CCNA Cards", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0e15" },
  ],
};

// Applies the theme before first paint. "system" follows the device setting live.
const THEME_SCRIPT = `(function(){try{var d=document.documentElement;function pref(){var m=document.cookie.match(/(?:^|; )theme=(\\w+)/);return m?m[1]:'system'}var mq=matchMedia('(prefers-color-scheme: dark)');function apply(){var t=pref();var dark=t==='dark'||(t!=='light'&&mq.matches);d.classList.toggle('dark',dark);d.style.colorScheme=dark?'dark':'light'}apply();mq.addEventListener('change',apply);window.__applyTheme=apply}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get("theme")?.value;
  const cls = theme === "dark" ? "dark" : undefined;
  return (
    <html lang="en" className={cls} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
