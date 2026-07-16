import type { Metadata } from "next";
import { requireOrgContext } from "@/lib/auth/context";
import { PageHeader } from "@/components/shared/page-header";
import { LogoUploader } from "@/components/settings/logo-uploader";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = {
  title: "Paramètres",
};

export default async function SettingsPage() {
  const { organization, role } = await requireOrgContext();
  const readOnly = role === "member";

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Paramètres"
        description="Coordonnées de votre entreprise, formats d'affichage et numérotation des réservations."
      />

      {readOnly && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Vous consultez ces paramètres en lecture seule. Seul un propriétaire
          ou un administrateur de l&apos;organisation peut les modifier.
        </div>
      )}

      <div className="space-y-6">
        <LogoUploader organization={organization} readOnly={readOnly} />
        <SettingsForm organization={organization} readOnly={readOnly} />
      </div>
    </div>
  );
}
