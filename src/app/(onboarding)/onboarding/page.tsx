import { redirect } from "next/navigation";
import { Waves } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/context";
import { deriveBookingPrefix } from "@/lib/core/org";
import type { BusinessType } from "@/lib/types/database";
import { OnboardingForm } from "./onboarding-form";

export const metadata = { title: "Configuration initiale" };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Une organisation existe déjà : l'onboarding est terminé.
  const context = await getOrgContext();
  if (context) redirect("/dashboard");

  const meta = (user.user_metadata ?? {}) as {
    company_name?: string;
    business_type?: BusinessType;
  };
  const companyName = meta.company_name ?? "";

  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-4 py-10 bg-neutral-50">
      <div className="mb-8 flex items-center gap-2 text-neutral-900">
        <span className="flex size-9 items-center justify-center rounded-lg bg-sky-700 text-white">
          <Waves className="size-5" aria-hidden />
        </span>
        <span className="text-xl font-semibold tracking-tight">
          Pacific Code
        </span>
      </div>
      <div className="w-full max-w-lg">
        <OnboardingForm
          defaults={{
            name: companyName,
            businessType: meta.business_type ?? "equipment",
            currency: "XPF",
            timezone: "Pacific/Tahiti",
            phone: "",
            address: "",
            bookingPrefix: companyName
              ? deriveBookingPrefix(companyName)
              : "RES",
          }}
        />
      </div>
    </div>
  );
}
