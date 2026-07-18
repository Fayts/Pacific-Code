"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

// Silhouettes de montagnes polynésiennes, en deux plans pour la parallaxe.
// Rendues en `currentColor` : la teinte se règle via `text-…`.

export function MountainsBack({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1440 320"
      preserveAspectRatio="none"
      className={cn("block h-full w-full", className)}
    >
      <path
        fill="currentColor"
        d="M0,320 L0,214 C70,206 130,168 210,172 C290,176 330,132 415,124 C500,116 555,158 640,150 C725,142 780,96 880,102 C980,108 1035,156 1120,148 C1205,140 1275,176 1355,168 L1440,176 L1440,320 Z"
      />
    </svg>
  );
}

export function MountainsFront({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1440 320"
      preserveAspectRatio="none"
      className={cn("block h-full w-full", className)}
    >
      <path
        fill="currentColor"
        d="M0,320 L0,268 L110,196 L200,240 L320,132 L410,208 L535,158 L655,226 L775,110 L895,196 L1015,150 L1135,232 L1255,186 L1355,242 L1440,214 L1440,320 Z"
      />
    </svg>
  );
}

// Carte abstraite des îles de la Société : points lumineux reliés à Papeete.
const ISLANDS = [
  { id: "bora", x: 96, y: 96, r: 5, label: "Bora Bora" },
  { id: "tahaa", x: 158, y: 132, r: 4 },
  { id: "raiatea", x: 150, y: 162, r: 6 },
  { id: "huahine", x: 238, y: 142, r: 5 },
  { id: "moorea", x: 396, y: 268, r: 7, label: "Moorea" },
  { id: "tahiti", x: 462, y: 300, r: 10, label: "Papeete" },
];

export function IslandsMap({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const hub = ISLANDS[ISLANDS.length - 1];

  return (
    <svg
      aria-hidden
      viewBox="0 0 600 400"
      className={cn("block h-auto w-full", className)}
    >
      {/* Liaisons courbes vers Papeete */}
      {ISLANDS.slice(0, -1).map((island, i) => {
        const midX = (island.x + hub.x) / 2;
        const midY = Math.min(island.y, hub.y) - 42;
        return (
          <motion.path
            key={island.id}
            d={`M${island.x},${island.y} Q${midX},${midY} ${hub.x},${hub.y}`}
            fill="none"
            stroke="#38cfe4"
            strokeOpacity={0.35}
            strokeWidth={1.2}
            strokeDasharray="3 5"
            initial={reduce ? false : { pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true, margin: "-15% 0px" }}
            transition={{ duration: 1.4, delay: 0.15 * i, ease: "easeOut" }}
          />
        );
      })}
      {/* Îles */}
      {ISLANDS.map((island, i) => (
        <g key={island.id}>
          <motion.circle
            cx={island.x}
            cy={island.y}
            r={island.r * 2.6}
            fill="#38cfe4"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: [0, 0.16, 0.08] }}
            viewport={{ once: true, margin: "-15% 0px" }}
            transition={{ duration: 1.6, delay: 0.1 * i }}
          />
          <motion.circle
            cx={island.x}
            cy={island.y}
            r={island.r}
            fill="#a9e8f2"
            initial={reduce ? false : { scale: 0, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true, margin: "-15% 0px" }}
            transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 * i }}
          />
          {island.label && (
            <motion.text
              x={island.x + island.r + 8}
              y={island.y + 4}
              fill="#a9e8f2"
              fillOpacity={0.75}
              fontSize={13}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: "-15% 0px" }}
              transition={{ delay: 0.3 + 0.1 * i }}
            >
              {island.label}
            </motion.text>
          )}
        </g>
      ))}
    </svg>
  );
}

// Fines lignes de vagues, pour séparer ou texturer sans motif envahissant.
export function WaveLines({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1440 60"
      preserveAspectRatio="none"
      className={cn("block w-full", className)}
    >
      {[14, 30, 46].map((y, i) => (
        <path
          key={y}
          d={`M0,${y} C180,${y - 8} 360,${y + 8} 540,${y} C720,${y - 8} 900,${y + 8} 1080,${y} C1260,${y - 8} 1380,${y + 4} 1440,${y}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
          strokeOpacity={0.5 - i * 0.14}
        />
      ))}
    </svg>
  );
}
