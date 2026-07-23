"use client";

// Onglet « Ma vitrine » : le lien public du loueur (+ QR code à imprimer),
// la personnalisation (texte d'accueil, visibilité) et les rappels sur ce
// qui alimente la vitrine (photos des fiches matériel, coordonnées).

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { toast } from "sonner";
import {
  Check,
  Copy,
  ExternalLink,
  ImagePlus,
  QrCode,
  Store,
} from "lucide-react";
import { useAppData } from "@/components/providers/app-data-provider";
import { updateStorefrontSettings } from "@/lib/services/organization-service";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

export function StorefrontSettingsClient() {
  const { provider, organization, version } = useAppData();
  const [pending, startTransition] = useTransition();
  const [welcome, setWelcome] = useState<string | null>(null);
  const [visible, setVisible] = useState<boolean | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isMock = provider.kind === "mock";
  const publicPath = isMock
    ? "/reserver/apercu"
    : `/reserver/${organization?.slug ?? ""}`;
  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${publicPath}`
      : publicPath;

  // Valeurs initiales depuis l'organisation (une fois chargée).
  useEffect(() => {
    if (!organization) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setWelcome((current) =>
        current === null ? (organization.storefront_welcome ?? "") : current
      );
      setVisible((current) =>
        current === null ? organization.storefront_visible : current
      );
    });
    return () => {
      cancelled = true;
    };
  }, [organization]);

  // QR code du lien public (généré dans le navigateur).
  useEffect(() => {
    if (!organization) return;
    let cancelled = false;
    QRCode.toDataURL(publicUrl, {
      width: 220,
      margin: 1,
      color: { dark: "#0b2233", light: "#ffffff" },
    })
      .then((dataUrl) => {
        if (!cancelled) setQr(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQr(null);
      });
    return () => {
      cancelled = true;
    };
  }, [publicUrl, organization]);

  if (!organization || welcome === null || visible === null) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copie impossible — sélectionnez le lien à la main.");
    }
  };

  const save = () => {
    startTransition(async () => {
      const result = await updateStorefrontSettings(
        { welcome: welcome ?? "", visible: visible ?? true },
        provider
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Vitrine mise à jour");
    });
  };

  return (
    <div key={version}>
      <PageHeader
        title="Ma vitrine"
        description="Votre page publique : partagez-la sur Facebook, dans votre bio ou en QR code au comptoir — vos clients y voient votre catalogue."
        actions={
          <Button
            variant="outline"
            render={
              <a href={publicUrl} target="_blank" rel="noopener noreferrer" />
            }
          >
            <ExternalLink className="size-4" aria-hidden />
            Voir ma vitrine
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="space-y-4">
          {/* Lien public */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="size-4 text-primary" aria-hidden />
                Votre adresse publique
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2 text-sm">
                  {publicUrl}
                </code>
                <Button type="button" variant="outline" size="sm" onClick={copy}>
                  {copied ? (
                    <Check className="size-4 text-emerald-600" aria-hidden />
                  ) : (
                    <Copy className="size-4" aria-hidden />
                  )}
                  {copied ? "Copié !" : "Copier"}
                </Button>
              </div>
              {isMock ? (
                <p className="text-xs text-muted-foreground">
                  Mode démonstration : la vitrine n&apos;est visible que sur
                  cet appareil.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Collez ce lien dans votre page Facebook, votre bio Instagram
                  ou vos réponses aux clients.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Personnalisation */}
          <Card>
            <CardHeader>
              <CardTitle>Personnalisation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="storefront-welcome">
                  Texte d&apos;accueil
                </Label>
                <Textarea
                  id="storefront-welcome"
                  rows={3}
                  maxLength={600}
                  value={welcome}
                  onChange={(e) => setWelcome(e.target.value)}
                  placeholder="Ex. : Location de matériel de nettoyage professionnel à Papeete — réservez en 2 minutes, retrait ou livraison."
                />
                <p className="text-xs text-muted-foreground">
                  Affiché sous le nom de votre entreprise, en haut de la
                  vitrine.
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                <div>
                  <Label htmlFor="storefront-visible">Vitrine en ligne</Label>
                  <p className="text-xs text-muted-foreground">
                    Désactivée : le lien affiche « page introuvable ».
                  </p>
                </div>
                <Switch
                  id="storefront-visible"
                  checked={visible}
                  onCheckedChange={setVisible}
                />
              </div>

              <div className="flex justify-end">
                <Button type="button" onClick={save} disabled={pending}>
                  {pending ? "Enregistrement…" : "Enregistrer"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Ce qui alimente la vitrine */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImagePlus className="size-4 text-primary" aria-hidden />
                Ce qui s&apos;affiche sur la vitrine
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                — Les <strong>photos et tarifs</strong> viennent de vos{" "}
                <Link href="/equipment" className="text-primary hover:underline">
                  fiches matériel
                </Link>{" "}
                (seuls les biens disponibles apparaissent).
              </p>
              <p>
                — Les <strong>coordonnées</strong> viennent de vos{" "}
                <Link href="/settings" className="text-primary hover:underline">
                  paramètres
                </Link>{" "}
                — le vocabulaire s&apos;adapte à votre type d&apos;activité.
              </p>
              <p>
                — La <strong>réservation en ligne</strong> avec signature du
                contrat arrive dans une prochaine étape : la vitrine invite
                pour l&apos;instant vos clients à vous contacter.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* QR code */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="size-4 text-primary" aria-hidden />
              QR code du comptoir
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qr}
                alt="QR code de votre vitrine"
                className="size-52 rounded-xl ring-1 ring-pc-deep/10"
              />
            ) : (
              <Skeleton className="size-52 rounded-xl" />
            )}
            <p className="text-center text-xs text-muted-foreground">
              Imprimez-le et posez-le au comptoir ou sur le matériel : vos
              clients scannent et retrouvent tout votre catalogue.
            </p>
            {qr && (
              <Button
                variant="outline"
                size="sm"
                render={<a href={qr} download="vitrine-qr-code.png" />}
              >
                Télécharger le QR code
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
