import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { CalendarPlus, PackagePlus, Sparkles, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ACTIONS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/bookings/new", label: "Nouvelle réservation", icon: CalendarPlus },
  { href: "/customers/new", label: "Nouveau client", icon: UserPlus },
  { href: "/equipment/new", label: "Ajouter un matériel", icon: PackagePlus },
  { href: "/assistant", label: "Ouvrir l'assistant", icon: Sparkles },
];

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions rapides</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {ACTIONS.map((action) => (
            <Button
              key={action.href}
              variant="outline"
              className="h-auto flex-col gap-2 py-3 whitespace-normal transition duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md hover:shadow-pc-deep/[0.06]"
              render={<Link href={action.href} />}
            >
              <action.icon className="size-4 text-primary" aria-hidden />
              <span className="text-center text-xs leading-snug font-medium">
                {action.label}
              </span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
