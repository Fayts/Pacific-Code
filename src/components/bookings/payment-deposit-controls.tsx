"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppData } from "@/components/providers/app-data-provider";
import {
  setDepositStatus,
  setPaymentStatus,
} from "@/lib/services/booking-service";
import { DEPOSIT_STATUS, PAYMENT_STATUS } from "@/lib/core/labels";
import type { DepositStatus, PaymentStatus } from "@/lib/types/database";

// Sélecteurs inline du statut de paiement et de caution d'une réservation.
export function PaymentDepositControls({
  bookingId,
  paymentStatus,
  depositStatus,
}: {
  bookingId: string;
  paymentStatus: PaymentStatus;
  depositStatus: DepositStatus;
}) {
  const { provider } = useAppData();
  const [payment, setPayment] = useState<PaymentStatus>(paymentStatus);
  const [deposit, setDeposit] = useState<DepositStatus>(depositStatus);
  const [paymentPending, startPaymentTransition] = useTransition();
  const [depositPending, startDepositTransition] = useTransition();

  const onPaymentChange = (value: PaymentStatus) => {
    const previous = payment;
    setPayment(value);
    startPaymentTransition(async () => {
      const result = await setPaymentStatus(bookingId, value, provider);
      if (!result.ok) {
        setPayment(previous);
        toast.error(result.error);
        return;
      }
      toast.success("Statut de paiement mis à jour");
    });
  };

  const onDepositChange = (value: DepositStatus) => {
    const previous = deposit;
    setDeposit(value);
    startDepositTransition(async () => {
      const result = await setDepositStatus(bookingId, value, provider);
      if (!result.ok) {
        setDeposit(previous);
        toast.error(result.error);
        return;
      }
      toast.success("Statut de caution mis à jour");
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Paiement</Label>
        <Select
          value={payment}
          onValueChange={(v) => onPaymentChange(v as PaymentStatus)}
          disabled={paymentPending}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PAYMENT_STATUS).map(([value, style]) => (
              <SelectItem key={value} value={value}>
                {style.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Caution</Label>
        <Select
          value={deposit}
          onValueChange={(v) => onDepositChange(v as DepositStatus)}
          disabled={depositPending}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(DEPOSIT_STATUS).map(([value, style]) => (
              <SelectItem key={value} value={value}>
                {style.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
