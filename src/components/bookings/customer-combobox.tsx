"use client";

import { useMemo, useState } from "react";
import { ChevronsUpDown, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatCustomerName } from "@/lib/core/format";
import { CUSTOMER_TYPE_LABELS } from "@/lib/core/labels";
import { cn } from "@/lib/utils";
import type { CustomerOption } from "./types";

// Combobox de recherche parmi les clients actifs (Command dans un Popover).
export function CustomerCombobox({
  customers,
  value,
  onChange,
  className,
}: {
  customers: CustomerOption[];
  value: string | null;
  onChange: (customerId: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => customers.find((c) => c.id === value) ?? null,
    [customers, value]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-full justify-between font-normal", className)}
          />
        }
      >
        <span
          className={cn(
            "flex min-w-0 items-center gap-2",
            !selected && "text-muted-foreground"
          )}
        >
          <User className="size-4 shrink-0 text-neutral-400" aria-hidden />
          <span className="truncate">
            {selected ? formatCustomerName(selected) : "Sélectionner un client"}
          </span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--anchor-width) min-w-64 p-1"
      >
        <Command>
          <CommandInput placeholder="Rechercher un client…" />
          <CommandList>
            <CommandEmpty>Aucun client trouvé.</CommandEmpty>
            <CommandGroup>
              {customers.map((customer) => {
                const name = formatCustomerName(customer);
                return (
                  <CommandItem
                    key={customer.id}
                    value={`${name} ${customer.email ?? ""} ${customer.phone ?? ""}`}
                    data-checked={customer.id === value}
                    onSelect={() => {
                      onChange(customer.id);
                      setOpen(false);
                    }}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {CUSTOMER_TYPE_LABELS[customer.type]}
                        {customer.phone ? ` · ${customer.phone}` : ""}
                        {customer.email ? ` · ${customer.email}` : ""}
                      </p>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
