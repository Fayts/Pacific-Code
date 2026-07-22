// Pastille de canal (Messenger, Gmail, WhatsApp, Formulaire) : icône et
// couleur reconnaissables dans toute la boîte de réception.

import {
  FileText,
  Mail,
  MessageCircle,
  Phone,
  type LucideIcon,
} from "lucide-react";
import { CHANNEL_LABELS } from "@/lib/core/labels";
import type { ChannelKind } from "@/lib/types/inbox";
import { cn } from "@/lib/utils";

const CHANNEL_STYLES: Record<
  ChannelKind,
  { icon: LucideIcon; chip: string }
> = {
  messenger: { icon: MessageCircle, chip: "bg-blue-100 text-blue-700" },
  gmail: { icon: Mail, chip: "bg-red-100 text-red-700" },
  outlook: { icon: Mail, chip: "bg-sky-100 text-sky-700" },
  whatsapp: { icon: Phone, chip: "bg-emerald-100 text-emerald-700" },
  form: { icon: FileText, chip: "bg-cyan-100 text-cyan-800" },
};

export function ChannelIcon({
  channel,
  className,
}: {
  channel: ChannelKind;
  className?: string;
}) {
  const style = CHANNEL_STYLES[channel];
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full",
        style.chip,
        className
      )}
      title={CHANNEL_LABELS[channel]}
    >
      <style.icon className="size-4" aria-hidden />
      <span className="sr-only">{CHANNEL_LABELS[channel]}</span>
    </span>
  );
}

export function ChannelLabel({ channel }: { channel: ChannelKind }) {
  const style = CHANNEL_STYLES[channel];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <style.icon className="size-3.5" aria-hidden />
      {CHANNEL_LABELS[channel]}
    </span>
  );
}
