import {
  Calendar,
  CalendarCheck,
  LayoutDashboard,
  Package,
  Settings,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/bookings", label: "Réservations", icon: CalendarCheck },
  { href: "/calendar", label: "Calendrier", icon: Calendar },
  { href: "/equipment", label: "Matériel", icon: Package },
  { href: "/customers", label: "Clients", icon: Users },
  { href: "/assistant", label: "Assistant IA", icon: Sparkles },
  { href: "/settings", label: "Paramètres", icon: Settings },
];
