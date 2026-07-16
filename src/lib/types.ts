export type CatalogCategory = "location" | "prestation";

export interface CatalogItem {
  slug: string;
  category: CatalogCategory;
  name: string;
  shortDescription: string;
  description: string;
  price: number; // XPF
  priceUnit: string; // ex: "/ jour", "/ prestation"
  deposit?: number; // caution XPF (locations)
  duration?: string; // durée indicative (prestations)
  features: string[];
  included: string[];
  popular?: boolean;
  icon: "machine" | "pack" | "sofa" | "bed";
}

export type BookingStatus =
  | "en_attente"
  | "confirmee"
  | "en_cours"
  | "terminee"
  | "annulee";

export type PaymentStatus = "en_attente" | "paye" | "rembourse";

export type FulfillmentMode = "livraison" | "retrait";

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  commune: string;
  bookingsCount: number;
  totalSpent: number;
  createdAt: string; // ISO
}

export interface Booking {
  id: string;
  reference: string;
  itemSlug: string;
  customerId: string;
  date: string; // ISO date (Pacific/Tahiti)
  endDate?: string;
  timeSlot: string;
  mode: FulfillmentMode;
  address?: string;
  commune?: string;
  deliveryFee: number;
  itemPrice: number;
  total: number;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  notes?: string;
  createdAt: string;
}

export interface DeliveryStop {
  bookingId: string;
  type: "livraison" | "recuperation";
  window: string;
}
