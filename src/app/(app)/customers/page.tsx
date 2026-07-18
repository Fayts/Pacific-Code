import type { Metadata } from "next";
import { Suspense } from "react";
import { CustomersListClient } from "@/components/customers/customers-list-client";
import CustomersLoading from "./loading";

export const metadata: Metadata = {
  title: "Clients",
};

// Les données viennent de la couche Repository (mock) côté client :
// cette page serveur ne porte que les métadonnées. Le Suspense est requis
// par useSearchParams() dans le composant client.
export default function CustomersPage() {
  return (
    <Suspense fallback={<CustomersLoading />}>
      <CustomersListClient />
    </Suspense>
  );
}
