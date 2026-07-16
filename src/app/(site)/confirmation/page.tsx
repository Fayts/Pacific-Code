import type { Metadata } from "next";
import { ConfirmationContent } from "./confirmation-content";

export const metadata: Metadata = { title: "Confirmation" };

export default function ConfirmationPage() {
  return <ConfirmationContent />;
}
