"use client";

// Retour du consentement OAuth Google / Microsoft : échange le code contre
// la connexion du compte e-mail (côté serveur — le fournisseur est porté
// par le state signé), puis renvoie vers la page Connexions.

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useAppData } from "@/components/providers/app-data-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const PROVIDER_NAMES: Record<string, string> = {
  gmail: "Gmail",
  outlook: "Outlook",
};

function EmailCallback() {
  const { provider, loading } = useAppData();
  const searchParams = useSearchParams();
  const started = useRef(false);
  const [state, setState] = useState<
    | { step: "working" }
    | { step: "done"; providerName: string; address: string }
    | { step: "error"; message: string }
  >({ step: "working" });

  const code = searchParams.get("code");
  const oauthState = searchParams.get("state");
  const oauthError =
    searchParams.get("error_description") ?? searchParams.get("error");

  useEffect(() => {
    if (loading || started.current) return;
    started.current = true;

    (async () => {
      if (oauthError || !code || !oauthState) {
        setState({
          step: "error",
          message: oauthError ?? "Connexion annulée ou incomplète.",
        });
        return;
      }
      try {
        const token = await provider.getAccessToken?.();
        if (!token) throw new Error("Session expirée — reconnectez-vous.");
        const response = await fetch("/api/channels/email/exchange", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            code,
            state: oauthState,
            redirectUri: `${window.location.origin}/assistant/connections/email-callback`,
          }),
        });
        const data = (await response.json()) as {
          provider?: string;
          address?: string;
          error?: string;
        };
        if (!response.ok || !data.address) {
          throw new Error(data.error ?? "Connexion du compte impossible.");
        }
        setState({
          step: "done",
          providerName: PROVIDER_NAMES[data.provider ?? ""] ?? "E-mail",
          address: data.address,
        });
      } catch (err) {
        setState({
          step: "error",
          message:
            err instanceof Error && err.message
              ? err.message
              : "Connexion du compte impossible.",
        });
      }
    })();
  }, [loading, provider, code, oauthState, oauthError]);

  return (
    <div className="mx-auto max-w-md pt-10">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          {state.step === "working" && (
            <>
              <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
              <p className="text-sm text-muted-foreground">
                Connexion de votre boîte e-mail et activation de la relève…
              </p>
            </>
          )}

          {state.step === "done" && (
            <>
              <span className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="size-6" aria-hidden />
              </span>
              <div>
                <p className="font-semibold">{state.providerName} connecté !</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {state.address} — les nouveaux e-mails arriveront dans votre
                  boîte de réception d&apos;ici 2 minutes.
                </p>
              </div>
              <Button render={<Link href="/assistant/connections" />}>
                Retour aux connexions
              </Button>
            </>
          )}

          {state.step === "error" && (
            <>
              <span className="flex size-12 items-center justify-center rounded-full bg-red-100 text-red-700">
                <XCircle className="size-6" aria-hidden />
              </span>
              <div>
                <p className="font-semibold">Connexion impossible</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {state.message}
                </p>
              </div>
              <Button
                variant="outline"
                render={<Link href="/assistant/connections" />}
              >
                Retour aux connexions
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function EmailCallbackPage() {
  return (
    <Suspense fallback={null}>
      <EmailCallback />
    </Suspense>
  );
}
