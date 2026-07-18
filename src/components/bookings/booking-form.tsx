"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Loader2,
  PackageSearch,
  Plus,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { EquipmentStatusBadge } from "@/components/shared/status-badge";
import { useAppData } from "@/components/providers/app-data-provider";
import {
  checkBookingAvailability,
  createBooking,
  updateBooking,
  type ItemAvailability,
} from "@/lib/services/booking-service";
import { parseLocalDateTimeInput } from "@/lib/core/dates";
import {
  computeBookingTotals,
  computeDurationDays,
  requiredMinRentalDays,
} from "@/lib/core/pricing";
import { formatDateTime, formatMoney } from "@/lib/core/format";
import { BOOKING_STATUS } from "@/lib/core/labels";
import { cn } from "@/lib/utils";
import { CustomerCombobox } from "./customer-combobox";
import { NewCustomerDialog } from "./new-customer-dialog";
import type {
  BookingFormInitialValues,
  BookingItemDraft,
  CustomerOption,
  EquipmentOption,
} from "./types";

type SubmittableStatus = "draft" | "pending" | "confirmed";

// Résultat de vérification, marqué par la « clé » (matériels + dates) qui l'a
// produit : un résultat obsolète est simplement ignoré à l'affichage.
type AvailabilityResultState =
  | {
      key: string;
      kind: "ok";
      items: ItemAvailability[];
      allAvailable: boolean;
    }
  | { key: string; kind: "error"; message: string };

function parseAmount(value: string): number {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function StepTitle({ step, children }: { step: number; children: ReactNode }) {
  return (
    <CardTitle className="flex items-center gap-2">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
        {step}
      </span>
      {children}
    </CardTitle>
  );
}

function availabilityReasonLabel(item: ItemAvailability): string {
  switch (item.reason) {
    case "conflict":
      return `quantité insuffisante (${item.available_quantity}/${item.total_quantity} disponible${item.available_quantity > 1 ? "s" : ""})`;
    case "maintenance":
      return "en maintenance";
    case "unavailable":
      return "indisponible";
    case "not_found":
      return "introuvable";
    case "invalid_period":
      return "période invalide";
    default:
      return "non disponible";
  }
}

export function BookingForm({
  mode,
  bookingId,
  organization,
  customers: initialCustomers,
  equipment,
  defaultStartAt,
  defaultEndAt,
  initialCustomerId,
  initialValues,
}: {
  mode: "create" | "edit";
  bookingId?: string;
  organization: { currency: string; timezone: string };
  customers: CustomerOption[];
  equipment: EquipmentOption[];
  defaultStartAt: string;
  defaultEndAt: string;
  initialCustomerId?: string | null;
  initialValues?: BookingFormInitialValues;
}) {
  const router = useRouter();
  const { provider } = useAppData();
  const [pending, startTransition] = useTransition();

  const tz = organization.timezone;
  const currency = organization.currency;

  // --- Client ---
  const [customers, setCustomers] = useState(initialCustomers);
  const [customerId, setCustomerId] = useState<string | null>(
    initialValues?.customerId ?? initialCustomerId ?? null
  );
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);

  // --- Matériels ---
  const [items, setItems] = useState<BookingItemDraft[]>(
    initialValues?.items ?? []
  );
  const [equipmentQuery, setEquipmentQuery] = useState("");

  // --- Période ---
  const [startAt, setStartAt] = useState(
    initialValues?.startAt ?? defaultStartAt
  );
  const [endAt, setEndAt] = useState(initialValues?.endAt ?? defaultEndAt);

  // --- Tarification ---
  const [discount, setDiscount] = useState(
    initialValues ? String(initialValues.discountAmount) : "0"
  );
  const [fees, setFees] = useState(
    initialValues ? String(initialValues.extraFeesAmount) : "0"
  );
  // Caution : null = suivre la suggestion (somme des cautions du matériel),
  // sinon valeur saisie manuellement.
  const [depositOverride, setDepositOverride] = useState<string | null>(
    initialValues ? String(initialValues.depositAmount) : null
  );
  const [notes, setNotes] = useState(initialValues?.notes ?? "");

  // --- Disponibilité ---
  const [availabilityResult, setAvailabilityResult] =
    useState<AvailabilityResultState | null>(null);
  const requestSeq = useRef(0);

  const equipmentById = useMemo(
    () => new Map(equipment.map((e) => [e.id, e])),
    [equipment]
  );

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === customerId) ?? null,
    [customers, customerId]
  );

  const selectedEquipment = useMemo(
    () =>
      items.flatMap((draft) => {
        const option = equipmentById.get(draft.equipmentId);
        return option ? [{ draft, option }] : [];
      }),
    [items, equipmentById]
  );

  const period = useMemo(() => {
    let start: Date;
    let end: Date;
    try {
      start = parseLocalDateTimeInput(startAt, tz);
      end = parseLocalDateTimeInput(endAt, tz);
    } catch {
      return { valid: false as const, error: "Dates invalides" };
    }
    if (end <= start) {
      return {
        valid: false as const,
        error: "Le retour doit être après le départ",
      };
    }
    return { valid: true as const, days: computeDurationDays(start, end) };
  }, [startAt, endAt, tz]);

  const durationDays = period.valid ? period.days : null;

  const minDays = useMemo(
    () =>
      selectedEquipment.length > 0
        ? requiredMinRentalDays(
            selectedEquipment.map((s) => s.option.min_rental_days)
          )
        : 1,
    [selectedEquipment]
  );

  const totals = useMemo(() => {
    if (!durationDays || selectedEquipment.length === 0) return null;
    return computeBookingTotals({
      items: selectedEquipment.map((s) => ({
        dailyPrice: s.option.daily_price,
        quantity: s.draft.quantity,
      })),
      durationDays,
      discountAmount: parseAmount(discount),
      extraFeesAmount: parseAmount(fees),
    });
  }, [durationDays, selectedEquipment, discount, fees]);

  const suggestedDeposit = useMemo(
    () =>
      selectedEquipment.reduce(
        (sum, s) => sum + s.option.deposit_amount * s.draft.quantity,
        0
      ),
    [selectedEquipment]
  );

  // Caution affichée : suggestion tant qu'elle n'a pas été modifiée à la main.
  const deposit = depositOverride ?? String(suggestedDeposit);

  // Vérification de disponibilité (debounce ~400 ms) à chaque changement
  // de matériels ou de dates. La clé identifie la combinaison vérifiée.
  const checkKey = useMemo(() => {
    if (items.length === 0 || !period.valid) return null;
    return JSON.stringify({ items, startAt, endAt });
  }, [items, period.valid, startAt, endAt]);

  useEffect(() => {
    if (!checkKey) return;
    const payload = JSON.parse(checkKey) as {
      items: BookingItemDraft[];
      startAt: string;
      endAt: string;
    };
    const seq = ++requestSeq.current;
    const timer = setTimeout(async () => {
      const response = await checkBookingAvailability(
        {
          items: payload.items,
          startAt: payload.startAt,
          endAt: payload.endAt,
          excludeBookingId: mode === "edit" ? (bookingId ?? null) : null,
        },
        provider
      );
      if (seq !== requestSeq.current) return;
      if (response.ok) {
        setAvailabilityResult({ key: checkKey, kind: "ok", ...response.data });
      } else {
        setAvailabilityResult({
          key: checkKey,
          kind: "error",
          message: response.error,
        });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [checkKey, mode, bookingId, provider]);

  const currentResult =
    checkKey && availabilityResult && availabilityResult.key === checkKey
      ? availabilityResult
      : null;
  const availability = currentResult?.kind === "ok" ? currentResult : null;
  const availabilityError =
    currentResult?.kind === "error" ? currentResult.message : null;
  const checking = checkKey !== null && currentResult === null;

  const toggleEquipment = (equipmentId: string) => {
    setItems((prev) =>
      prev.some((i) => i.equipmentId === equipmentId)
        ? prev.filter((i) => i.equipmentId !== equipmentId)
        : [...prev, { equipmentId, quantity: 1 }]
    );
  };

  const setQuantity = (equipmentId: string, raw: string, max: number) => {
    const parsed = Math.trunc(Number(raw));
    const quantity = Math.min(
      Math.max(1, Number.isFinite(parsed) ? parsed : 1),
      Math.max(1, max)
    );
    setItems((prev) =>
      prev.map((i) => (i.equipmentId === equipmentId ? { ...i, quantity } : i))
    );
  };

  const visibleEquipment = useMemo(() => {
    const q = equipmentQuery.trim().toLowerCase();
    if (!q) return equipment;
    return equipment.filter((e) => e.name.toLowerCase().includes(q));
  }, [equipment, equipmentQuery]);

  const unavailable = availability !== null && !availability.allAvailable;

  const submit = (status: SubmittableStatus) => {
    if (!customerId) {
      toast.error("Sélectionnez un client");
      return;
    }
    if (items.length === 0) {
      toast.error("Sélectionnez au moins un matériel");
      return;
    }
    if (!period.valid) {
      toast.error(period.error);
      return;
    }
    if (durationDays !== null && durationDays < minDays) {
      toast.error(
        `Durée minimale de location : ${minDays} jour${minDays > 1 ? "s" : ""}`
      );
      return;
    }
    if (status !== "draft" && unavailable) {
      toast.error(
        "Certains matériels ne sont pas disponibles sur cette période"
      );
      return;
    }

    const payload = {
      customerId,
      items,
      startAt,
      endAt,
      discountAmount: parseAmount(discount),
      extraFeesAmount: parseAmount(fees),
      depositAmount: parseAmount(deposit),
      notes: notes.trim(),
      status,
    };

    startTransition(async () => {
      if (mode === "edit" && bookingId) {
        const result = await updateBooking(bookingId, payload, provider);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Réservation mise à jour");
        router.push(`/bookings/${bookingId}`);
      } else {
        const result = await createBooking(payload, provider);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(
          status === "draft"
            ? "Brouillon enregistré"
            : status === "pending"
              ? "Réservation créée — à confirmer"
              : "Réservation créée et confirmée"
        );
        router.push(`/bookings/${result.data.bookingId}`);
      }
    });
  };

  // Statut conservé lors d'une modification (draft/pending/confirmed garanti
  // par isEditableStatus côté page).
  const editStatus = (initialValues?.status ?? "draft") as SubmittableStatus;

  return (
    <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
      <div className="space-y-4 lg:col-span-2">
        {/* 1. Client */}
        <Card>
          <CardHeader>
            <StepTitle step={1}>Client</StepTitle>
            <CardDescription>
              Recherchez un client existant ou créez-en un nouveau.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <CustomerCombobox
                customers={customers}
                value={customerId}
                onChange={setCustomerId}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setCustomerDialogOpen(true)}
              >
                <Plus data-icon="inline-start" aria-hidden />
                Nouveau client
              </Button>
            </div>
            {selectedCustomer &&
              (selectedCustomer.phone || selectedCustomer.email) && (
                <p className="text-sm text-muted-foreground">
                  {[selectedCustomer.phone, selectedCustomer.email]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
          </CardContent>
        </Card>

        {/* 2. Matériels */}
        <Card>
          <CardHeader>
            <StepTitle step={2}>Matériels</StepTitle>
            <CardDescription>
              {items.length > 0
                ? `${items.length} matériel${items.length > 1 ? "s" : ""} sélectionné${items.length > 1 ? "s" : ""}`
                : "Cochez le matériel à louer et ajustez les quantités."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {equipment.length === 0 ? (
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                <PackageSearch className="size-5 shrink-0" aria-hidden />
                <p>
                  Aucun matériel actif.{" "}
                  <Link
                    href="/equipment"
                    className="text-primary hover:text-primary/80 hover:underline"
                  >
                    Ajoutez d&apos;abord du matériel
                  </Link>
                  .
                </p>
              </div>
            ) : (
              <>
                {equipment.length > 5 && (
                  <Input
                    type="search"
                    placeholder="Filtrer le matériel…"
                    value={equipmentQuery}
                    onChange={(e) => setEquipmentQuery(e.target.value)}
                  />
                )}
                <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                  {visibleEquipment.length === 0 && (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      Aucun matériel ne correspond à «&nbsp;{equipmentQuery}
                      &nbsp;».
                    </p>
                  )}
                  {visibleEquipment.map((eq) => {
                    const selection = items.find(
                      (i) => i.equipmentId === eq.id
                    );
                    return (
                      <div
                        key={eq.id}
                        role="button"
                        tabIndex={-1}
                        onClick={() => toggleEquipment(eq.id)}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50",
                          selection && "border-primary/30 bg-primary/[0.06]"
                        )}
                      >
                        <Checkbox
                          checked={!!selection}
                          onCheckedChange={() => toggleEquipment(eq.id)}
                          className="pointer-events-none mt-0.5"
                          aria-label={`Sélectionner ${eq.name}`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium">{eq.name}</p>
                            <p className="text-sm whitespace-nowrap text-muted-foreground">
                              {formatMoney(eq.daily_price, currency)}
                              <span className="text-muted-foreground/70"> / jour</span>
                            </p>
                          </div>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            <span>
                              Caution {formatMoney(eq.deposit_amount, currency)}
                            </span>
                            <span>· {eq.quantity_total} ex.</span>
                            {eq.min_rental_days > 1 && (
                              <span>· min. {eq.min_rental_days} j</span>
                            )}
                            {eq.status !== "available" && (
                              <EquipmentStatusBadge status={eq.status} />
                            )}
                          </p>
                          {selection && (
                            <div
                              className="mt-2 flex items-center gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Label
                                htmlFor={`qty-${eq.id}`}
                                className="text-xs text-muted-foreground"
                              >
                                Quantité
                              </Label>
                              <Input
                                id={`qty-${eq.id}`}
                                type="number"
                                min={1}
                                max={eq.quantity_total}
                                value={selection.quantity}
                                onChange={(e) =>
                                  setQuantity(
                                    eq.id,
                                    e.target.value,
                                    eq.quantity_total
                                  )
                                }
                                className="h-7 w-20"
                              />
                              <span className="text-xs text-muted-foreground/70">
                                / {eq.quantity_total} max
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* 3. Période */}
        <Card>
          <CardHeader>
            <StepTitle step={3}>Période</StepTitle>
            <CardDescription>
              Heures de départ et de retour dans le fuseau de votre entreprise.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start-at">Départ</Label>
                <Input
                  id="start-at"
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-at">Retour</Label>
                <Input
                  id="end-at"
                  type="datetime-local"
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                />
              </div>
            </div>
            {period.valid ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarClock
                  className="size-4 text-muted-foreground/70"
                  aria-hidden
                />
                Durée facturable :{" "}
                <span className="font-medium text-foreground">
                  {period.days} jour{period.days > 1 ? "s" : ""}
                </span>
              </p>
            ) : (
              <p className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="size-4" aria-hidden />
                {period.error}
              </p>
            )}
            {period.valid && durationDays !== null && durationDays < minDays && (
              <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                Durée minimale requise par le matériel sélectionné :{" "}
                {minDays} jour{minDays > 1 ? "s" : ""}.
              </p>
            )}
          </CardContent>
        </Card>

        {/* 4. Disponibilité */}
        <Card>
          <CardHeader>
            <StepTitle step={4}>Disponibilité</StepTitle>
            <CardDescription>
              Vérifiée automatiquement à chaque changement de matériel ou de
              dates.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sélectionnez au moins un matériel pour vérifier la
                disponibilité.
              </p>
            ) : !period.valid ? (
              <p className="text-sm text-muted-foreground">
                Renseignez une période valide pour vérifier la disponibilité.
              </p>
            ) : (
              <>
                {checking && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Vérification de la disponibilité…
                  </p>
                )}
                {availabilityError && (
                  <p className="text-sm text-destructive">{availabilityError}</p>
                )}
                {availability?.items.map((item) =>
                  item.available ? (
                    <div
                      key={item.equipmentId}
                      className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
                    >
                      <CheckCircle2
                        className="mt-0.5 size-4 shrink-0"
                        aria-hidden
                      />
                      <p>
                        <span className="font-medium">
                          {item.equipmentName}
                        </span>{" "}
                        — Disponible ({item.available_quantity}/
                        {item.total_quantity})
                      </p>
                    </div>
                  ) : (
                    <div
                      key={item.equipmentId}
                      className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                    >
                      <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                      <div className="min-w-0">
                        <p>
                          <span className="font-medium">
                            {item.equipmentName}
                          </span>{" "}
                          — {availabilityReasonLabel(item)}
                        </p>
                        {item.conflicts.length > 0 && (
                          <ul className="mt-1 space-y-0.5 text-xs text-red-700">
                            {item.conflicts.map((conflict) => (
                              <li key={conflict.booking_id}>
                                Réservé par {conflict.booking_number} —{" "}
                                {conflict.customer_name} du{" "}
                                {formatDateTime(conflict.start_at, tz)} au{" "}
                                {formatDateTime(conflict.end_at, tz)} (
                                {conflict.quantity} ex.,{" "}
                                {BOOKING_STATUS[conflict.status].label})
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )
                )}
                {unavailable && mode === "create" && (
                  <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    <AlertTriangle
                      className="mt-0.5 size-4 shrink-0"
                      aria-hidden
                    />
                    La réservation ne peut pas être confirmée en l&apos;état,
                    mais vous pouvez l&apos;enregistrer comme brouillon.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <StepTitle step={5}>Notes</StepTitle>
            <CardDescription>
              Informations internes ou consignes pour cette réservation
              (facultatif).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={3}
              placeholder="Ex : livraison prévue à 7 h 30, prévoir une rallonge…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </CardContent>
        </Card>
      </div>

      {/* Tarification + actions */}
      <div className="space-y-4 lg:sticky lg:top-20">
        <Card>
          <CardHeader>
            <CardTitle>Tarification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedEquipment.length > 0 && durationDays ? (
              <ul className="space-y-1.5 text-sm">
                {selectedEquipment.map((s, index) => (
                  <li
                    key={s.option.id}
                    className="flex items-baseline justify-between gap-2"
                  >
                    <span className="min-w-0 truncate text-muted-foreground">
                      {s.option.name}{" "}
                      <span className="text-muted-foreground/70">
                        × {s.draft.quantity} × {durationDays} j
                      </span>
                    </span>
                    <span className="whitespace-nowrap tabular-nums">
                      {formatMoney(totals?.lineTotals[index] ?? 0, currency)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sélectionnez du matériel et une période pour calculer le prix.
              </p>
            )}

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Sous-total</span>
              <span className="font-medium tabular-nums">
                {formatMoney(totals?.subtotal ?? 0, currency)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="discount">Remise</Label>
                <Input
                  id="discount"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="extra-fees">Frais supp.</Label>
                <Input
                  id="extra-fees"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={fees}
                  onChange={(e) => setFees(e.target.value)}
                />
              </div>
            </div>

            <Separator />

            <div className="flex items-end justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Total
              </span>
              <span className="text-2xl font-semibold tracking-tight tabular-nums">
                {formatMoney(totals?.total ?? 0, currency)}
              </span>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="deposit">Caution</Label>
              <Input
                id="deposit"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                value={deposit}
                onChange={(e) => setDepositOverride(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Suggestion (cautions du matériel) :{" "}
                {formatMoney(suggestedDeposit, currency)}
                {depositOverride !== null &&
                  parseAmount(deposit) !== suggestedDeposit && (
                    <button
                      type="button"
                      className="ml-1.5 font-medium text-primary hover:text-primary/80 hover:underline"
                      onClick={() => setDepositOverride(null)}
                    >
                      Appliquer
                    </button>
                  )}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2">
          {mode === "create" ? (
            <>
              <Button
                type="button"
                className="w-full"
                disabled={pending || unavailable}
                onClick={() => submit("confirmed")}
              >
                {pending && (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                )}
                Créer et confirmer
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                disabled={pending || unavailable}
                onClick={() => submit("pending")}
              >
                À confirmer
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={pending}
                onClick={() => submit("draft")}
              >
                Enregistrer comme brouillon
              </Button>
              {unavailable && (
                <p className="text-center text-xs text-destructive">
                  Matériel indisponible : seul l&apos;enregistrement en
                  brouillon est possible.
                </p>
              )}
            </>
          ) : (
            <>
              <Button
                type="button"
                className="w-full"
                disabled={pending || (editStatus !== "draft" && unavailable)}
                onClick={() => submit(editStatus)}
              >
                {pending && (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                )}
                Enregistrer les modifications
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={pending}
                render={<Link href={`/bookings/${bookingId}`} />}
              >
                Annuler
              </Button>
              {editStatus !== "draft" && unavailable && (
                <p className="text-center text-xs text-destructive">
                  Impossible d&apos;enregistrer : un matériel n&apos;est plus
                  disponible sur cette période.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <NewCustomerDialog
        open={customerDialogOpen}
        onOpenChange={setCustomerDialogOpen}
        onCreated={(customer) => {
          setCustomers((prev) => [customer, ...prev]);
          setCustomerId(customer.id);
        }}
      />
    </div>
  );
}
