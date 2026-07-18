"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SidebarBrand, SidebarNavList } from "@/components/layout/sidebar";

export function MobileNav({ organizationName }: { organizationName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Ouvrir le menu"
          />
        }
      >
        <Menu className="size-5" aria-hidden />
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-72 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
      >
        <SheetHeader className="border-b border-sidebar-border px-4 py-3">
          <SheetTitle className="text-left">
            <SidebarBrand organizationName={organizationName} />
          </SheetTitle>
        </SheetHeader>
        <nav className="p-2">
          <SidebarNavList
            layoutId="mobile-nav-active"
            onNavigate={() => setOpen(false)}
          />
        </nav>
      </SheetContent>
    </Sheet>
  );
}
