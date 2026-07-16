import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/shell";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { COMPANY } from "@/lib/data";

export const metadata: Metadata = { title: "Paramètres" };

export default function SettingsPage() {
  return (
    <>
      <AdminPageHeader
        title="Paramètres"
        description="Configuration de l'entreprise — formulaire de démonstration, aucune sauvegarde réelle."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="font-semibold text-navy-900">Entreprise</h2>
          <div className="mt-5 space-y-4">
            <Field label="Nom de l'entreprise">
              <Input defaultValue={COMPANY.name} />
            </Field>
            <Field label="Téléphone">
              <Input defaultValue={COMPANY.phone} />
            </Field>
            <Field label="E-mail de contact">
              <Input defaultValue={COMPANY.email} />
            </Field>
            <Field label="Adresse">
              <Input defaultValue={COMPANY.address} />
            </Field>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold text-navy-900">Réservations & livraisons</h2>
          <div className="mt-5 space-y-4">
            <Field label="Devise">
              <Select defaultValue="XPF">
                <option value="XPF">XPF — Franc pacifique</option>
              </Select>
            </Field>
            <Field label="Fuseau horaire">
              <Select defaultValue="Pacific/Tahiti">
                <option value="Pacific/Tahiti">Pacific/Tahiti (UTC−10)</option>
              </Select>
            </Field>
            <Field
              label="Zone de livraison incluse"
              hint="Livraison sans supplément entre ces deux communes."
            >
              <Input defaultValue="Papenoo – Papeete" />
            </Field>
            <Field label="Supplément hors zone (XPF)">
              <Input type="number" defaultValue={COMPANY.deliverySurcharge} />
            </Field>
            <Field label="Délai minimum de réservation">
              <Select defaultValue="24">
                <option value="12">12 heures</option>
                <option value="24">24 heures</option>
                <option value="48">48 heures</option>
              </Select>
            </Field>
          </div>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <h2 className="font-semibold text-navy-900">Notifications</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {[
              "E-mail à chaque nouvelle réservation",
              "SMS de rappel au client la veille",
              "Alerte quand un paiement est en attente depuis 48 h",
              "Récapitulatif hebdomadaire le lundi matin",
            ].map((label, i) => (
              <label
                key={label}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-mist-200 p-4 text-sm text-navy-700"
              >
                <input
                  type="checkbox"
                  defaultChecked={i < 2}
                  className="h-4 w-4 accent-lagoon-600"
                />
                {label}
              </label>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost">Annuler</Button>
        <Button variant="accent">Enregistrer (démo)</Button>
      </div>
    </>
  );
}
