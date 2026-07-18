import Link from "next/link";
import { Info } from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

export const metadata = { title: "Réinitialisation" };

// Mode démonstration : la gestion des mots de passe est simulée.
export default function ResetPasswordPage() {
  return (
    <Card className="border-white/60 bg-white/85 shadow-xl shadow-cyan-900/10 backdrop-blur-md">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-sky-600 via-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-600/25">
          <Info className="size-6" aria-hidden />
        </span>
        <h2 className="text-lg font-semibold">Version de démonstration</h2>
        <p className="max-w-sm text-sm text-neutral-600">
          Les mots de passe ne sont pas vérifiés dans cette version.
          Connectez-vous directement avec n&apos;importe quel email.
        </p>
        <Link href="/login" className="text-sm text-sky-700 hover:underline">
          Retour à la connexion
        </Link>
      </CardContent>
    </Card>
  );
}
