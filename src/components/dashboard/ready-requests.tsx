"use client";

// « Demandes prêtes à convertir » : conversations où l'agent a réuni
// bien + dates + disponibilité — l'argent qui attend un clic. Analyse
// locale (règles + vraies données), aucun crédit IA. Le widget disparaît
// quand il n'y a rien à convertir.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { CalendarCheck, Loader2, MessageCircle } from "lucide-react";
import { useAppData } from "@/components/providers/app-data-provider";
import {
  findReadyRequests,
  prepareBookingConversion,
  type ReadyRequest,
} from "@/lib/ai/booking-conversion";
import { formatMoney } from "@/lib/core/format";
import { ChannelIcon } from "@/components/inbox/channel-badge";
import { Button } from "@/components/ui/button";

function periodLabel(local: string): string {
  const [date, time] = local.split("T");
  if (!date || !time) return local;
  const [, month, day] = date.split("-");
  return `${day}/${month} ${time.replace(":", " h ")}`;
}

export function ReadyRequests() {
  const { provider, organization, version } = useAppData();
  const router = useRouter();
  const [requests, setRequests] = useState<ReadyRequest[]>([]);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  useEffect(() => {
    if (!organization) return;
    let cancelled = false;
    void (async () => {
      try {
        const settings = await provider.agentSettings.get();
        const found = await findReadyRequests({
          provider,
          organization,
          settings,
        });
        if (!cancelled) setRequests(found);
      } catch {
        if (!cancelled) setRequests([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [provider, organization, version]);

  if (!organization || requests.length === 0) return null;
  const currency = organization.currency;

  const convert = async (request: ReadyRequest) => {
    if (convertingId) return;
    setConvertingId(request.conversation.id);
    try {
      const ok = await prepareBookingConversion(
        request.conversation,
        request.analysis,
        provider
      );
      if (!ok) {
        toast.error("Conversion impossible — ouvrez la conversation.");
        return;
      }
      router.push("/bookings/new?from=conversation");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Conversion impossible — réessayez."
      );
    } finally {
      setConvertingId(null);
    }
  };

  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm shadow-pc-deep/[0.04]">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
        <CalendarCheck className="size-4" aria-hidden />
        Demandes prêtes à convertir
        <span className="rounded-full bg-emerald-600/10 px-2 py-0.5 text-xs font-semibold text-emerald-700">
          {requests.length}
        </span>
      </h2>
      <ul className="mt-3 space-y-2">
        {requests.map((request) => {
          const { conversation, analysis } = request;
          return (
            <li
              key={conversation.id}
              className="flex flex-wrap items-center gap-3 rounded-lg bg-card px-3.5 py-2.5 ring-1 ring-pc-deep/[0.06]"
            >
              <ChannelIcon channel={conversation.channel} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {conversation.customer_name}
                  <span className="text-muted-foreground"> · </span>
                  {analysis.equipment?.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {analysis.period
                    ? `${periodLabel(analysis.period.startAt)} → ${periodLabel(analysis.period.endAt)}`
                    : ""}
                  {analysis.pricing && (
                    <>
                      {" · "}
                      <strong className="text-emerald-700">
                        {formatMoney(analysis.pricing.total, currency)}
                      </strong>
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  render={<Link href={`/inbox?c=${conversation.id}`} />}
                >
                  <MessageCircle className="size-4" aria-hidden />
                  Voir
                </Button>
                <Button
                  size="sm"
                  className="bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
                  disabled={convertingId !== null}
                  onClick={() => void convert(request)}
                >
                  {convertingId === conversation.id ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <CalendarCheck className="size-4" aria-hidden />
                  )}
                  Créer la réservation
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
