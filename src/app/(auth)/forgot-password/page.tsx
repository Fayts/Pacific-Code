import Link from "next/link";
import { Info } from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

export const metadata = { title: "Mot de passe oublié" };

// Mode démonstration : aucun email n'est envoyé.
export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-sky-50">
          <Info className="size-6 text-sky-700" aria-hidden />
        </span>
        <h2 className="text-lg font-semibold">Version de démonstration</h2>
        <p className="max-w-sm text-sm text-neutral-600">
          Aucun email n&apos;est envoyé dans cette version : les comptes sont
          simulés. Connectez-vous simplement avec n&apos;importe quel email et
          mot de passe.
        </p>
        <Link href="/login" className="text-sm text-sky-700 hover:underline">
          Retour à la connexion
        </Link>
      </CardContent>
    </Card>
  );
}
