export interface NavItem {
  href: string;
  label: string;
  icon: string; // lucide icon name key
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Overview", icon: "globe" },
  { href: "/location", label: "My Location", icon: "mapPin" },
  { href: "/map", label: "World Map", icon: "map" },
  { href: "/news", label: "Live News", icon: "newspaper" },
  { href: "/topics", label: "Topics & Regions", icon: "layers" },
  { href: "/timeline", label: "Situation Timeline", icon: "gitCommitVertical" },
  { href: "/what-changed", label: "What Changed", icon: "activity" },
  { href: "/alerts", label: "Alerts", icon: "bell" },
  { href: "/saved", label: "Saved Items", icon: "bookmark" },
  { href: "/sources", label: "Sources & Methodology", icon: "database" },
  { href: "/settings", label: "Settings", icon: "settings" },
];
