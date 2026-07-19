"use client";

import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { motion } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OnboardingProgress } from "@/lib/core/onboarding";
import { cn } from "@/lib/utils";

// Checklist d'activation avec barre de progression.
export function OnboardingChecklist({
  progress,
  className,
}: {
  progress: OnboardingProgress;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Votre démarrage</CardTitle>
        <div className="mt-1 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <motion.div
              initial={false}
              animate={{ width: `${Math.max(4, progress.ratio * 100)}%` }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="h-full rounded-full bg-gradient-to-r from-pc-lagoon to-pc-turquoise"
            />
          </div>
          <span className="text-xs font-semibold tabular-nums text-muted-foreground">
            {progress.doneCount}/{progress.totalCount}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2.5">
          {progress.steps.map((step) => (
            <li key={step.id}>
              <Link
                href={step.href}
                className="group flex items-center gap-2.5 text-sm"
              >
                {step.done ? (
                  <CheckCircle2
                    className="size-4 shrink-0 text-emerald-600"
                    aria-hidden
                  />
                ) : (
                  <Circle
                    className="size-4 shrink-0 text-muted-foreground/40"
                    aria-hidden
                  />
                )}
                <span
                  className={cn(
                    step.done
                      ? "text-muted-foreground line-through decoration-muted-foreground/40"
                      : "text-foreground transition-colors group-hover:text-primary"
                  )}
                >
                  {step.label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
