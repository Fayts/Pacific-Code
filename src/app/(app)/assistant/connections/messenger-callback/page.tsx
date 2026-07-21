"use client";

// Retour du dialogue OAuth Facebook : échange le code contre la connexion
// de la Page (côté serveur), puis renvoie vers la page Connexions.

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useAppData } from "@/components/providers/app-data-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function MessengerCallback() {
  const { provider, loading } = useAppData();
  const searchParams = useSearchParams();
  const started = useRef(false);
  const [state, setState] = useState<
    | { step: "working" }
    | { step: "done"; pageName: string; otherPages: string[] }
    | { step: "error"; message: string }
  >({ step: "working" });

  const code = searchParams.get("code");
  const oauthState = searchParams.get("state");
  const fbError = searchParams.get("error_description");

  useEffect(() => {
    if (loading || started.current) return;
    started.current = true;

    (async () => {
      if (fbError || !code || !oauthState) {
        setState({
          step: "error",
          message: fbError ?? "Connexion annulée ou incomplète.",
        });
        return;
      }
      try {
        const token = await provider.getAccessToken?.();
        if (!token) throw new Error("Session expirée — reconnectez-vous.");
        const response = await fetch("/api/channels/messenger/exchange", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            code,
            state: oauthState,
            redirectUri: `${window.location.origin}/assistant/connections/messenger-callback`,
          }),
        });
        const data = (await response.json()) as {
          pageName?: string;
          otherPages?: string[];
          error?: string;
        };
        if (!response.ok || !data.pageName) {
          throw new Error(data.error ?? "Connexion Facebook impossible.");
        }
        setState({
          step: "done",
          pageName: data.pageName,
          otherPages: data.otherPages ?? [],
        });
      } catch (err) {
        setState({
          step: "error",
          message:
            err instanceof Error && err.message
              ? err.message
              : "Connexion Facebook impossible.",
        });
      }
    })();
  }, [loading, provider, code, oauthState, fbError]);

  return (
    <div className="mx-auto max-w-md pt-10">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          {state.step === "working" && (
            <>
              <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
              <p className="text-sm text-muted-foreground">
                Connexion de votre Page Facebook et activation des webhooks…
              </p>
            </>
          )}

          {state.step === "done" && (
            <>
              <span className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="size-6" aria-hidden />
              </span>
              <div>
                <p className="font-semibold">Messenger connecté !</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Page « {state.pageName} » — les messages reçus arriveront
                  dans votre boîte de réception.
                </p>
                {state.otherPages.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Autres Pages détectées (non connectées) :{" "}
                    {state.otherPages.join(", ")}
                  </p>
                )}
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

export default function MessengerCallbackPage() {
  return (
    <Suspense fallback={null}>
      <MessengerCallback />
    </Suspense>
  );
}
