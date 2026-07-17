"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAppData } from "@/components/providers/app-data-provider";
import { formatInitials } from "@/lib/core/format";

export function UserMenu({
  userName,
  email,
}: {
  userName: string;
  email: string;
}) {
  const router = useRouter();
  const { provider } = useAppData();
  const [, startTransition] = useTransition();

  const handleSignOut = () => {
    startTransition(async () => {
      await provider.auth.signOut();
      router.replace("/login");
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        aria-label="Menu utilisateur"
      >
        <Avatar className="size-8">
          <AvatarFallback className="bg-sky-100 text-sky-800 text-xs font-semibold">
            {formatInitials(userName || email)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium">{userName}</p>
          <p className="truncate text-xs text-neutral-500">{email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/settings" />}>
          <Settings className="size-4" aria-hidden />
          Paramètres
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
          <LogOut className="size-4" aria-hidden />
          Déconnexion
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
