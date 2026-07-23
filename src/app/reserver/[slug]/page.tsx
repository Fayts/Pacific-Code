// Vitrine publique d'un loueur : /reserver/<slug>. Lecture via la fonction
// SQL publique (champs sûrs uniquement) — aucune session requise, la RLS
// des tables reste fermée. En mode mock, la vitrine de démonstration reste
// /reserver/apercu (les données vivent dans le navigateur du loueur).

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  StorefrontView,
  type StorefrontData,
} from "@/components/storefront/storefront-view";
import { createAnonClient, rawRpc } from "@/lib/supabase/token-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Réserver",
};

export default async function PublicStorefrontPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (process.env.NEXT_PUBLIC_DATA_MODE !== "supabase") {
    notFound();
  }

  const { data } = await rawRpc<StorefrontData | null>(
    createAnonClient(),
    "get_public_storefront",
    { p_slug: slug }
  );
  if (!data) notFound();

  return <StorefrontView data={data} />;
}
