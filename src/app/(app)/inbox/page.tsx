import type { Metadata } from "next";
import { Suspense } from "react";
import { InboxClient } from "@/components/inbox/inbox-client";

export const metadata: Metadata = {
  title: "Boîte de réception",
};

// Les données viennent de la couche Repository (mock) côté client :
// cette page serveur ne porte que les métadonnées. Le Suspense est requis
// par useSearchParams() (conversation sélectionnée ?c=).
export default function InboxPage() {
  return (
    <Suspense fallback={null}>
      <InboxClient />
    </Suspense>
  );
}
