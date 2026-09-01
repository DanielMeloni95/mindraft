import {
  Archive,
  CheckSquare,
  FolderKanban,
  Home,
  Inbox,
  Lightbulb,
  Network,
  Search,
  Settings,
  Star,
  CalendarCheck,
  GitBranch,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Key of the badge counter provided by the shell, if any. */
  badge?: "inbox" | "tasks";
};

export const PRIMARY_NAV: NavItem[] = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/inbox", label: "Inbox", icon: Inbox, badge: "inbox" },
  { href: "/ideas", label: "Idee", icon: Lightbulb },
  { href: "/projects", label: "Progetti", icon: FolderKanban },
  { href: "/subprojects", label: "Sottoprogetti", icon: GitBranch },
  { href: "/tools", label: "Strumenti", icon: Wrench },
  { href: "/map", label: "Mappa globale", icon: Network },
  { href: "/tasks", label: "Attività", icon: CheckSquare, badge: "tasks" },
  { href: "/search", label: "Ricerca", icon: Search },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: "/review", label: "Revisione", icon: CalendarCheck },
  { href: "/favorites", label: "Preferiti", icon: Star },
  { href: "/archive", label: "Archivio", icon: Archive },
  { href: "/settings", label: "Impostazioni", icon: Settings },
];

export const MOBILE_NAV: NavItem[] = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/inbox", label: "Inbox", icon: Inbox, badge: "inbox" },
  { href: "/projects", label: "Progetti", icon: FolderKanban },
  { href: "/tasks", label: "Attività", icon: CheckSquare, badge: "tasks" },
];
