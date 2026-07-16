import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

/* --------------------------------- Button --------------------------------- */

type ButtonVariant = "primary" | "accent" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-navy-900 text-white hover:bg-navy-800 focus-visible:outline-navy-900",
  accent:
    "bg-lagoon-500 text-white hover:bg-lagoon-600 focus-visible:outline-lagoon-600",
  outline:
    "border border-mist-300 bg-white text-navy-900 hover:border-lagoon-400 hover:text-lagoon-700 focus-visible:outline-lagoon-600",
  ghost: "text-navy-700 hover:bg-mist-100 focus-visible:outline-navy-900",
  danger: "bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-7 text-base",
};

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      {...props}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <Link
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      {...props}
    />
  );
}

/* ---------------------------------- Card ---------------------------------- */

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-mist-200 bg-white shadow-[0_1px_3px_rgba(10,37,64,0.06)]",
        className
      )}
      {...props}
    />
  );
}

/* ---------------------------------- Badge --------------------------------- */

type BadgeTone = "navy" | "lagoon" | "gray" | "green" | "amber" | "red";

const badgeTones: Record<BadgeTone, string> = {
  navy: "bg-navy-100 text-navy-800",
  lagoon: "bg-lagoon-100 text-lagoon-800",
  gray: "bg-mist-200 text-navy-600",
  green: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-700",
};

export function Badge({
  tone = "gray",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        badgeTones[tone],
        className
      )}
      {...props}
    />
  );
}

/* --------------------------------- Champs --------------------------------- */

const fieldBase =
  "w-full rounded-xl border border-mist-300 bg-white px-3.5 text-sm text-navy-900 placeholder:text-navy-300 focus:border-lagoon-500 focus:outline-none focus:ring-2 focus:ring-lagoon-200 transition";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldBase, "h-11", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(fieldBase, "h-11 cursor-pointer", className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldBase, "min-h-24 py-2.5", className)} {...props} />;
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      className={cn("mb-1.5 block text-sm font-medium text-navy-800", className)}
      {...props}
    />
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {hint ? <p className="mt-1 text-xs text-navy-400">{hint}</p> : null}
    </div>
  );
}

/* ------------------------------ Section titles ---------------------------- */

export function SectionTitle({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "center" | "left";
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" ? "mx-auto text-center" : "")}>
      {eyebrow ? (
        <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-lagoon-600">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-3xl font-semibold tracking-tight text-navy-900 sm:text-4xl">
        {title}
      </h2>
      {description ? <p className="mt-3 text-navy-500">{description}</p> : null}
    </div>
  );
}
