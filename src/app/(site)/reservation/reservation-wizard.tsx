"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardList,
  MapPin,
  PackageCheck,
  Store,
  Truck,
  UserRound,
} from "lucide-react";
import type { CatalogItem, FulfillmentMode } from "@/lib/types";
import {
  ALL_COMMUNES,
  CATALOG,
  COMPANY,
  deliveryFeeFor,
  FREE_DELIVERY_COMMUNES,
  TIME_SLOTS,
} from "@/lib/data";
import { formatDate, formatXPF } from "@/lib/format";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Select,
  Textarea,
  cn,
} from "@/components/ui";
import { ProductVisual } from "@/components/product-visual";

const STEPS = [
  { key: "produit", label: "Produit", icon: PackageCheck },
  { key: "date", label: "Date", icon: CalendarDays },
  { key: "livraison", label: "Livraison", icon: Truck },
  { key: "infos", label: "Vos infos", icon: UserRound },
  { key: "recap", label: "Récapitulatif", icon: ClipboardList },
] as const;

export interface DemoBooking {
  reference: string;
  itemSlug: string;
  itemName: string;
  category: string;
  date: string;
  timeSlot: string;
  mode: FulfillmentMode;
  commune?: string;
  address?: string;
  deliveryFee: number;
  itemPrice: number;
  total: number;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  notes?: string;
  createdAt: string;
}

export function ReservationWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselected = searchParams.get("produit");

  const [step, setStep] = useState(0);
  const [itemSlug, setItemSlug] = useState<string | null>(
    preselected && CATALOG.some((i) => i.slug === preselected) ? preselected : null
  );
  const [date, setDate] = useState("");
  const [timeSlot, setTimeSlot] = useState("");
  const [mode, setMode] = useState<FulfillmentMode>("livraison");
  const [commune, setCommune] = useState(FREE_DELIVERY_COMMUNES[0]);
  const [address, setAddress] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const item: CatalogItem | undefined = useMemo(
    () => CATALOG.find((i) => i.slug === itemSlug),
    [itemSlug]
  );

  const deliveryFee = mode === "livraison" ? deliveryFeeFor(commune) : 0;
  const total = (item?.price ?? 0) + deliveryFee;

  const canContinue = [
    Boolean(item),
    Boolean(date && timeSlot),
    mode === "retrait" || Boolean(address.trim()),
    Boolean(firstName.trim() && lastName.trim() && email.trim() && phone.trim()),
    true,
  ][step];

  function confirm() {
    if (!item) return;
    const now = new Date();
    const booking: DemoBooking = {
      // Référence pseudo-unique dérivée de l'horodatage (démo sans serveur)
      reference: `PRC-${2600 + (now.getTime() % 400)}`,
      itemSlug: item.slug,
      itemName: item.name,
      category: item.category,
      date,
      timeSlot,
      mode,
      commune: mode === "livraison" ? commune : undefined,
      address: mode === "livraison" ? address : undefined,
      deliveryFee,
      itemPrice: item.price,
      total,
      customer: { firstName, lastName, email, phone },
      notes: notes || undefined,
      createdAt: now.toISOString(),
    };
    // Maquette : la réservation est stockée en local (remplacé par Supabase plus tard)
    localStorage.setItem("prc-demo-booking", JSON.stringify(booking));
    const history = JSON.parse(localStorage.getItem("prc-demo-bookings") ?? "[]");
    localStorage.setItem(
      "prc-demo-bookings",
      JSON.stringify([booking, ...history])
    );
    router.push("/confirmation");
  }

  const today = "2026-07-16"; // date fictive de la maquette (Pacific/Tahiti)

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight text-navy-900">
        Réserver
      </h1>
      <p className="mt-2 text-navy-500">
        Simulation de réservation — aucune donnée n&apos;est envoyée, tout reste
        sur votre appareil.
      </p>

      {/* Barre d'étapes */}
      <ol className="mt-8 flex items-center gap-2 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <li key={s.key} className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => i < step && setStep(i)}
              className={cn(
                "flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
                i === step
                  ? "bg-navy-900 text-white"
                  : i < step
                    ? "bg-lagoon-100 text-lagoon-800 cursor-pointer"
                    : "bg-mist-100 text-navy-400"
              )}
            >
              {i < step ? <Check size={15} /> : <s.icon size={15} />}
              <span className="hidden sm:inline">{s.label}</span>
            </button>
            {i < STEPS.length - 1 ? (
              <span className="h-px w-4 bg-mist-300 sm:w-6" />
            ) : null}
          </li>
        ))}
      </ol>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_310px]">
        <Card className="p-6 sm:p-8">
          {/* Étape 1 — Produit */}
          {step === 0 ? (
            <div>
              <h2 className="text-xl font-semibold">Choisissez votre produit</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {CATALOG.map((i) => (
                  <button
                    key={i.slug}
                    onClick={() => setItemSlug(i.slug)}
                    className={cn(
                      "flex flex-col overflow-hidden rounded-2xl border-2 text-left transition-all",
                      itemSlug === i.slug
                        ? "border-lagoon-500 shadow-[0_4px_20px_rgba(12,166,184,0.18)]"
                        : "border-mist-200 hover:border-mist-300"
                    )}
                  >
                    <ProductVisual item={i} className="h-24" iconSize={34} />
                    <div className="p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-navy-900">{i.name}</p>
                        {itemSlug === i.slug ? (
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lagoon-500 text-white">
                            <Check size={13} />
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-navy-500">
                        {formatXPF(i.price)}{" "}
                        <span className="text-navy-400">{i.priceUnit}</span>
                      </p>
                      <Badge
                        tone={i.category === "location" ? "navy" : "lagoon"}
                        className="mt-2"
                      >
                        {i.category === "location" ? "Location" : "Prestation"}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Étape 2 — Date */}
          {step === 1 ? (
            <div>
              <h2 className="text-xl font-semibold">Choisissez date et créneau</h2>
              <div className="mt-5 max-w-xs">
                <Field label="Date souhaitée" hint="Fuseau horaire : Pacific/Tahiti">
                  <Input
                    type="date"
                    min={today}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </Field>
              </div>
              <p className="mt-6 mb-1.5 text-sm font-medium text-navy-800">
                Créneau {mode === "retrait" ? "de retrait" : "de livraison"}
              </p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {TIME_SLOTS.map((slot) => (
                  <button
                    key={slot}
                    onClick={() => setTimeSlot(slot)}
                    className={cn(
                      "rounded-xl border-2 px-4 py-3 text-sm font-medium transition-all",
                      timeSlot === slot
                        ? "border-lagoon-500 bg-lagoon-50 text-lagoon-800"
                        : "border-mist-200 text-navy-600 hover:border-mist-300"
                    )}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Étape 3 — Livraison ou retrait */}
          {step === 2 ? (
            <div>
              <h2 className="text-xl font-semibold">Livraison ou retrait ?</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => setMode("livraison")}
                  className={cn(
                    "rounded-2xl border-2 p-5 text-left transition-all",
                    mode === "livraison"
                      ? "border-lagoon-500 bg-lagoon-50"
                      : "border-mist-200 hover:border-mist-300"
                  )}
                >
                  <Truck size={22} className="text-lagoon-600" />
                  <p className="mt-3 font-semibold text-navy-900">Livraison</p>
                  <p className="mt-1 text-sm text-navy-500">
                    Incluse entre Papenoo et Papeete, +
                    {formatXPF(COMPANY.deliverySurcharge)} au-delà.
                  </p>
                </button>
                <button
                  onClick={() => setMode("retrait")}
                  className={cn(
                    "rounded-2xl border-2 p-5 text-left transition-all",
                    mode === "retrait"
                      ? "border-lagoon-500 bg-lagoon-50"
                      : "border-mist-200 hover:border-mist-300"
                  )}
                >
                  <Store size={22} className="text-lagoon-600" />
                  <p className="mt-3 font-semibold text-navy-900">
                    Retrait au dépôt
                  </p>
                  <p className="mt-1 text-sm text-navy-500">
                    Gratuit — Papeete, du lundi au samedi.
                  </p>
                </button>
              </div>

              {mode === "livraison" ? (
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <Field label="Commune">
                    <Select
                      value={commune}
                      onChange={(e) => setCommune(e.target.value)}
                    >
                      {ALL_COMMUNES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                          {FREE_DELIVERY_COMMUNES.includes(c)
                            ? " — livraison incluse"
                            : ` — +${formatXPF(COMPANY.deliverySurcharge)}`}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Adresse / point de repère">
                    <Input
                      placeholder="PK, servitude, couleur du portail…"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </Field>
                  <div className="sm:col-span-2 flex items-center gap-2.5 rounded-xl bg-mist-50 p-3.5 text-sm text-navy-600">
                    <MapPin size={16} className="shrink-0 text-lagoon-600" />
                    {deliveryFee === 0
                      ? "Bonne nouvelle : la livraison est incluse pour cette commune."
                      : `Cette commune est hors zone : supplément de ${formatXPF(deliveryFee)}.`}
                  </div>
                </div>
              ) : (
                <div className="mt-6 flex items-center gap-2.5 rounded-xl bg-mist-50 p-3.5 text-sm text-navy-600">
                  <Store size={16} className="shrink-0 text-lagoon-600" />
                  Dépôt Pacific Rent&Clean — Papeete. L&apos;adresse exacte vous
                  sera envoyée avec la confirmation.
                </div>
              )}
            </div>
          ) : null}

          {/* Étape 4 — Informations */}
          {step === 3 ? (
            <div>
              <h2 className="text-xl font-semibold">Vos informations</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Prénom">
                  <Input
                    placeholder="Moana"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </Field>
                <Field label="Nom">
                  <Input
                    placeholder="Teriipaia"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </Field>
                <Field label="E-mail">
                  <Input
                    type="email"
                    placeholder="moana@mail.pf"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
                <Field label="Téléphone">
                  <Input
                    type="tel"
                    placeholder="+689 87 12 34 56"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Remarques (facultatif)">
                    <Textarea
                      placeholder="Canapé d'angle, tissu fragile, portail bleu…"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </Field>
                </div>
              </div>
            </div>
          ) : null}

          {/* Étape 5 — Récapitulatif */}
          {step === 4 && item ? (
            <div>
              <h2 className="text-xl font-semibold">Récapitulatif</h2>
              <dl className="mt-5 divide-y divide-mist-200 text-sm">
                {[
                  ["Produit", item.name],
                  ["Date", date ? formatDate(date) : "—"],
                  ["Créneau", timeSlot],
                  [
                    "Mode",
                    mode === "livraison"
                      ? `Livraison — ${commune}`
                      : "Retrait au dépôt (Papeete)",
                  ],
                  ...(mode === "livraison" && address
                    ? ([["Adresse", address]] as const)
                    : []),
                  ["Client", `${firstName} ${lastName}`],
                  ["Contact", `${email} · ${phone}`],
                  ...(notes ? ([["Remarques", notes]] as const) : []),
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-6 py-3">
                    <dt className="text-navy-400">{label}</dt>
                    <dd className="text-right font-medium text-navy-800">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 rounded-2xl bg-navy-950 p-5 text-white">
                <div className="flex justify-between text-sm text-navy-200">
                  <span>{item.name}</span>
                  <span>{formatXPF(item.price)}</span>
                </div>
                <div className="mt-1.5 flex justify-between text-sm text-navy-200">
                  <span>
                    {mode === "livraison" ? "Livraison" : "Retrait au dépôt"}
                  </span>
                  <span>
                    {deliveryFee === 0 ? "Incluse" : formatXPF(deliveryFee)}
                  </span>
                </div>
                <div className="mt-3 flex justify-between border-t border-white/15 pt-3 text-lg font-semibold">
                  <span>Total</span>
                  <span className="text-lagoon-300">{formatXPF(total)}</span>
                </div>
                {item.deposit ? (
                  <p className="mt-2 text-xs text-navy-300">
                    + caution de {formatXPF(item.deposit)} restituée au retour du
                    matériel.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between border-t border-mist-200 pt-6">
            <Button
              variant="ghost"
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
            >
              <ArrowLeft size={16} /> Retour
            </Button>
            {step < STEPS.length - 1 ? (
              <Button
                variant="accent"
                onClick={() => setStep(step + 1)}
                disabled={!canContinue}
              >
                Continuer <ArrowRight size={16} />
              </Button>
            ) : (
              <Button variant="accent" size="lg" onClick={confirm}>
                Confirmer ma réservation <Check size={17} />
              </Button>
            )}
          </div>
        </Card>

        {/* Panier latéral */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="overflow-hidden">
            {item ? (
              <>
                <ProductVisual item={item} className="h-28" iconSize={40} />
                <div className="p-5">
                  <p className="font-semibold text-navy-900">{item.name}</p>
                  <dl className="mt-3 space-y-1.5 text-sm text-navy-500">
                    {date ? <div>📅 {formatDate(date)}</div> : null}
                    {timeSlot ? <div>🕑 {timeSlot}</div> : null}
                    <div>
                      {mode === "livraison"
                        ? `🚚 Livraison — ${commune}`
                        : "🏬 Retrait au dépôt"}
                    </div>
                  </dl>
                  <div className="mt-4 flex justify-between border-t border-mist-200 pt-3 font-semibold">
                    <span>Total</span>
                    <span className="text-lagoon-700">{formatXPF(total)}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-5 text-sm text-navy-400">
                Sélectionnez un produit pour voir le résumé de votre réservation.
              </div>
            )}
          </Card>
          <p className="mt-3 text-center text-xs text-navy-400">
            Démo — devise XPF · fuseau Pacific/Tahiti
          </p>
        </aside>
      </div>
    </div>
  );
}
