import type { Metadata } from "next";
import { AccountContent } from "./account-content";

export const metadata: Metadata = { title: "Mon espace" };

export default function AccountPage() {
  return <AccountContent />;
}
