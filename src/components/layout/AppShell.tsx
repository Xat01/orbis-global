"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { PreferencesProvider } from "@/components/providers/PreferencesProvider";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <PreferencesProvider>
      <div className="flex min-h-screen">
        <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar onMenuClick={() => setMenuOpen(true)} />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
            <ErrorBoundary fallbackTitle="This section failed to render. The rest of ORBIS keeps working.">
              {children}
            </ErrorBoundary>
          </main>
          <footer className="border-t border-line px-4 py-3 text-center text-[11px] text-muted">
            ORBIS · local situational intelligence · public sources with attribution · not
            independent verification
          </footer>
        </div>
      </div>
    </PreferencesProvider>
  );
}
