import type { Metadata } from "next";
import { StorefrontSettingsClient } from "@/components/storefront/storefront-settings-client";

export const metadata: Metadata = {
  title: "Ma vitrine",
};

export default function StorefrontSettingsPage() {
  return <StorefrontSettingsClient />;
}
