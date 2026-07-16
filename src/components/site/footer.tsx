import Link from "next/link";
import { Droplets, Mail, MapPin, Phone } from "lucide-react";
import { COMPANY } from "@/lib/data";

export function SiteFooter() {
  return (
    <footer className="border-t border-navy-800 bg-navy-950 text-navy-200">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-lagoon-400 to-lagoon-600 text-white">
              <Droplets size={19} strokeWidth={2.2} />
            </span>
            <span className="text-[17px] font-semibold tracking-tight text-white">
              Pacific <span className="text-lagoon-400">Rent&Clean</span>
            </span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-navy-300">
            {COMPANY.tagline}. Matériel professionnel, résultats impeccables,
            partout entre Papenoo et Papeete.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-white">Navigation</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link href="/locations" className="hover:text-lagoon-300">Locations de matériel</Link></li>
            <li><Link href="/prestations" className="hover:text-lagoon-300">Prestations à domicile</Link></li>
            <li><Link href="/reservation" className="hover:text-lagoon-300">Réserver</Link></li>
            <li><Link href="/compte" className="hover:text-lagoon-300">Mon espace client</Link></li>
            <li><Link href="/admin" className="hover:text-lagoon-300">Espace administrateur (démo)</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-white">Contact</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li className="flex items-center gap-2"><Phone size={15} className="text-lagoon-400" />{COMPANY.phone}</li>
            <li className="flex items-center gap-2"><Mail size={15} className="text-lagoon-400" />{COMPANY.email}</li>
            <li className="flex items-start gap-2"><MapPin size={15} className="mt-0.5 shrink-0 text-lagoon-400" />{COMPANY.address}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-navy-800/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-navy-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© 2026 Pacific Rent&Clean — Maquette de démonstration</p>
          <p>Fuseau horaire : Pacific/Tahiti · Devise : XPF</p>
        </div>
      </div>
    </footer>
  );
}
