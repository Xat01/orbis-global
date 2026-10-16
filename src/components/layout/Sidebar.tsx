"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  Bookmark,
  Database,
  GitCommitVertical,
  Globe,
  Layers,
  Map,
  MapPin,
  Newspaper,
  Settings,
  X,
} from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  globe: Globe,
  mapPin: MapPin,
  map: Map,
  newspaper: Newspaper,
  layers: Layers,
  gitCommitVertical: GitCommitVertical,
  activity: Activity,
  bell: Bell,
  bookmark: Bookmark,
  database: Database,
  settings: Settings,
};

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 border-r border-black/10 bg-charcoal text-white transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Main navigation"
      >
        <div className="flex h-14 items-center justify-between gap-2 border-b border-white/10 px-4">
          <Link href="/" className="flex items-center gap-2" onClick={onClose}>
            <span className="flex h-7 w-7 items-center justify-center rounded bg-accent text-xs font-bold text-white">
              O
            </span>
            <span>
              <span className="block text-sm font-bold tracking-wide">ORBIS</span>
              <span className="block text-[10px] text-white/60">
                Understand the world. See what matters.
              </span>
            </span>
          </Link>
          <button
            className="rounded p-1 text-white/70 hover:bg-white/10 lg:hidden"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="p-2">
          <ul className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const Icon = ICONS[item.icon] ?? Globe;
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors ${
                      active
                        ? "bg-accent/20 font-semibold text-white"
                        : "text-white/75 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mx-2 mt-2 rounded-md border border-white/10 bg-white/5 p-2.5 text-[10px] leading-relaxed text-white/60">
          Runs locally — no deployment, no tracking. Data is retrieved periodically from public
          sources, not streamed in real time.
        </div>
      </aside>
    </>
  );
}
