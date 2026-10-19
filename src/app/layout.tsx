import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: {
    default: "ORBIS — Global Situational Intelligence",
    template: "%s · ORBIS",
  },
  description:
    "ORBIS turns scattered public reporting into clear, evidence-backed explanations of important developments around the world. Understand the world. See what matters.",
  robots: { index: false, follow: false }, // local, private instance
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f5" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1211" },
  ],
};

// Applies the stored theme before first paint so there is no light/dark flash.
// Mirrors PreferencesProvider: explicit "light"/"dark" wins, otherwise the OS
// preference decides. Kept dependency-free and inlined on purpose.
const THEME_BOOTSTRAP = `(function(){try{var k="orbis.prefs.v1";var raw=localStorage.getItem(k);var t=raw?JSON.parse(raw).theme:null;if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.dataset.theme=t;}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-forest focus:px-3 focus:py-1.5 focus:text-xs focus:text-white"
        >
          Skip to main content
        </a>
        <AppShell>
          <div id="main-content">{children}</div>
        </AppShell>
      </body>
    </html>
  );
}
