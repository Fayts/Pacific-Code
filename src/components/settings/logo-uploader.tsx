"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { updateOrganizationLogo } from "@/server/actions/organizations";
import { formatInitials } from "@/lib/core/format";
import type { Organization } from "@/lib/types/database";

const ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
];
const MAX_SIZE_BYTES = 2 * 1024 * 1024;

export function LogoUploader({
  organization,
  readOnly = false,
}: {
  organization: Organization;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  // Aperçu immédiat après téléversement, avant le rafraîchissement serveur.
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  const logoSrc = uploadedUrl ?? organization.logo_url;

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Permet de resélectionner le même fichier plus tard.
    event.target.value = "";
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Format accepté : PNG, JPG, WebP ou SVG");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast.error("Logo trop volumineux (2 Mo maximum)");
      return;
    }

    const formData = new FormData();
    formData.append("logo", file);

    startTransition(async () => {
      const result = await updateOrganizationLogo(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setUploadedUrl(result.data.logoUrl);
      toast.success("Logo mis à jour");
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logo</CardTitle>
        <CardDescription>
          Visible sur vos documents et dans l&apos;application.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              alt={`Logo de ${organization.name}`}
              className="size-16 shrink-0 rounded-lg border border-neutral-200 bg-white object-contain p-1"
            />
          ) : (
            <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-sky-700 text-lg font-semibold text-white">
              {formatInitials(organization.name)}
            </div>
          )}
          <div className="space-y-1.5">
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              className="sr-only"
              onChange={onFileChange}
              disabled={readOnly || pending}
            />
            <Button
              type="button"
              variant="outline"
              disabled={readOnly || pending}
              onClick={() => inputRef.current?.click()}
            >
              {pending ? "Téléversement…" : "Choisir une image"}
            </Button>
            <p className="text-xs text-neutral-500">
              PNG, JPG, WebP ou SVG — 2 Mo maximum.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
