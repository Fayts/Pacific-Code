"use client";

// Agent IA d'onboarding : conversation à gauche, brouillon vivant à
// droite (onglets sur mobile). Le brouillon est la mémoire de référence ;
// la conversation reprend après fermeture de la page. Rien n'est créé
// sans passage par l'écran de vérification.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Camera,
  FileText,
  KeyRound,
  ListChecks,
  MessageCircle,
  Paperclip,
  RotateCcw,
  Send,
  Sparkles,
  Undo2,
  X,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAppData } from "@/components/providers/app-data-provider";
import {
  emptyDraft,
  nextTempId,
  onboardingDraftSchema,
  type DraftItem,
  type OnboardingDraft,
} from "@/lib/agent/draft";
import { computeCompleteness } from "@/lib/agent/completeness";
import type { DraftChange } from "@/lib/agent/tools";
import {
  clearConversation,
  loadConversation,
  saveConversation,
  type AgentMessage,
} from "@/lib/agent/store";
import {
  MAX_ATTACHMENTS,
  prepareAttachment,
  type PreparedAttachment,
} from "@/lib/agent/attachments";
import { DraftPanel } from "@/components/onboarding/agent/draft-panel";

const EASE = [0.16, 1, 0.3, 1] as const;
const HISTORY_LIMIT = 10;
const UNDO_LIMIT = 15;

const GREETING =
  "Bonjour 👋 Je vais construire votre activité avec vous. Décrivez simplement ce que vous louez, avec vos mots — vous pouvez aussi coller une annonce, ou joindre une photo de vos tarifs ou une brochure PDF avec le trombone ci-dessous.";

const ATTACH_GREETING =
  "Bonjour 👋 Joignez votre brochure PDF ou une photo de votre grille tarifaire avec le trombone ci-dessous — j’en extrais vos biens et vos tarifs, puis nous complétons ensemble.";

/** Message envoyé au serveur quand on joint un fichier sans texte. */
const ATTACH_ONLY_MESSAGE =
  "Analysez le ou les documents joints et construisez mon activité.";

const SUGGESTIONS = [
  "Je loue du matériel",
  "Je loue des véhicules",
  "Je loue des logements",
  "J’ai une activité mixte",
  "Je vais coller une annonce",
];

type AgentMode = "ai" | "dev" | "unconfigured" | null;

type AgentResponse = {
  mode: "ai" | "dev" | "unconfigured";
  reply?: string;
  draft?: unknown;
  changes?: DraftChange[];
  readyForReview?: boolean;
  error?: string;
};

function ThinkingIndicator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="flex items-center gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
            transition={{
              duration: 1.1,
              repeat: Infinity,
              delay: i * 0.18,
              ease: "easeInOut",
            }}
            className="size-1.5 rounded-full bg-pc-lagoon"
          />
        ))}
      </span>
      {label}
    </div>
  );
}

function AttachmentChip({ kind, name }: { kind: "image" | "pdf"; name: string }) {
  const Icon = kind === "pdf" ? FileText : Camera;
  return (
    <span className="flex items-center gap-1 rounded-lg bg-white/20 px-2 py-1 text-xs font-medium">
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="max-w-44 truncate">{name}</span>
    </span>
  );
}

export function AgentStep({
  onReview,
  onUseTextMethod,
  initialHint,
}: {
  onReview: (draft: OnboardingDraft) => void;
  onUseTextMethod: () => void;
  /** « attach » : accueil orienté brochure/photo (carte PDF du sélecteur). */
  initialHint?: "attach";
}) {
  const { session } = useAppData();
  const reduce = useReducedMotion();
  const userId = session?.user.id ?? null;

  const [loaded, setLoaded] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [draft, setDraft] = useState<OnboardingDraft>(emptyDraft());
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<PreparedAttachment[]>([]);
  const [analyzingDoc, setAnalyzingDoc] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailed, setLastFailed] = useState<{
    text: string;
    attachments: PreparedAttachment[];
  } | null>(null);
  const [agentMode, setAgentMode] = useState<AgentMode>(null);
  const [reviewProposed, setReviewProposed] = useState(false);
  const [reviewDismissed, setReviewDismissed] = useState(false);
  const [flashes, setFlashes] = useState<DraftChange[]>([]);
  const [undoStack, setUndoStack] = useState<OnboardingDraft[]>([]);
  const [tab, setTab] = useState<"chat" | "draft">("chat");
  const [unseenChanges, setUnseenChanges] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reprise de conversation (par utilisateur).
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      const stored = loadConversation(userId);
      if (stored && stored.messages.length > 0) {
        setMessages(stored.messages);
        setDraft(stored.draft);
      } else {
        setMessages([
          {
            role: "assistant",
            text: initialHint === "attach" ? ATTACH_GREETING : GREETING,
            at: new Date().toISOString(),
          },
        ]);
      }
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, initialHint]);

  // Défilement intelligent : suit la conversation seulement si on est
  // déjà proche du bas (on ne vole pas la lecture de l'historique).
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const nearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      160;
    if (nearBottom) {
      endRef.current?.scrollIntoView({
        behavior: reduce ? "auto" : "smooth",
        block: "end",
      });
    }
  }, [messages, busy, reduce]);

  const progress = useMemo(() => computeCompleteness(draft), [draft]);
  const canReview = draft.items.length > 0;
  const highlightReview = reviewProposed || progress.readyForReview;
  const showReviewPrompt = highlightReview && !reviewDismissed;

  const persist = useCallback(
    (nextMessages: AgentMessage[], nextDraft: OnboardingDraft) => {
      if (userId) saveConversation(userId, nextMessages, nextDraft);
    },
    [userId]
  );

  const pushUndo = useCallback((snapshot: OnboardingDraft) => {
    setUndoStack((stack) => [...stack.slice(-(UNDO_LIMIT - 1)), snapshot]);
  }, []);

  const applyLocalChange = useCallback(
    (
      mutate: (current: OnboardingDraft) => OnboardingDraft,
      label: string,
      itemId?: string
    ) => {
      setDraft((current) => {
        const next = onboardingDraftSchema.parse(mutate(current));
        pushUndo(current);
        persist(messages, next);
        return next;
      });
      setFlashes([{ kind: "item_updated", label, itemId }]);
    },
    [messages, persist, pushUndo]
  );

  const send = useCallback(
    async (
      rawText: string,
      options?: {
        retry?: { text: string; attachments: PreparedAttachment[] };
      }
    ) => {
      const pending = options?.retry?.attachments ?? attachments;
      const text = (options?.retry?.text ?? rawText).trim();
      if ((!text && pending.length === 0) || busy || !loaded) return;
      setError(null);
      setLastFailed(null);
      setBusy(true);
      setAnalyzingDoc(pending.length > 0);

      const history = messages.slice(-HISTORY_LIMIT).map((m) => ({
        role: m.role,
        text: m.text,
      }));
      const withUser: AgentMessage[] = options?.retry
        ? messages
        : [
            ...messages,
            {
              role: "user",
              text,
              at: new Date().toISOString(),
              attachments:
                pending.length > 0
                  ? pending.map((a) => ({ kind: a.kind, name: a.name }))
                  : undefined,
            },
          ];
      if (!options?.retry) {
        setMessages(withUser);
        setInput("");
        setAttachments([]);
      }

      try {
        const response = await fetch("/api/onboarding/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text || ATTACH_ONLY_MESSAGE,
            draft,
            history,
            attachments: pending.length > 0 ? pending : undefined,
          }),
        });
        const payload = (await response.json()) as AgentResponse;

        if (!response.ok) {
          throw new Error(payload.error ?? "L’agent n’a pas pu répondre.");
        }
        if (payload.mode === "unconfigured") {
          setAgentMode("unconfigured");
          return;
        }

        setAgentMode(payload.mode);
        const checked = onboardingDraftSchema.safeParse(payload.draft);
        const nextDraft = checked.success ? checked.data : draft;
        if (checked.success) {
          pushUndo(draft);
        }

        const reply: AgentMessage = {
          role: "assistant",
          text: payload.reply ?? "C’est noté.",
          at: new Date().toISOString(),
        };
        const nextMessages = [...withUser, reply];
        setMessages(nextMessages);
        setDraft(nextDraft);
        setFlashes(payload.changes ?? []);
        if ((payload.changes ?? []).length > 0 && tab === "chat") {
          setUnseenChanges(true);
        }
        if (payload.readyForReview) {
          setReviewProposed(true);
          setReviewDismissed(false);
        }
        persist(nextMessages, nextDraft);
      } catch (fetchError) {
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "L’agent n’a pas pu répondre."
        );
        setLastFailed({ text, attachments: pending });
      } finally {
        setBusy(false);
        setAnalyzingDoc(false);
      }
    },
    [attachments, busy, loaded, messages, draft, persist, pushUndo, tab]
  );

  const addFiles = useCallback(
    async (list: FileList | null) => {
      if (!list || list.length === 0) return;
      setError(null);
      const files = Array.from(list);
      const room = MAX_ATTACHMENTS - attachments.length;
      if (files.length > room) {
        setError(`Maximum ${MAX_ATTACHMENTS} pièces jointes par message.`);
      }
      for (const file of files.slice(0, Math.max(0, room))) {
        try {
          const prepared = await prepareAttachment(file);
          setAttachments((current) =>
            current.length >= MAX_ATTACHMENTS
              ? current
              : [...current, prepared]
          );
        } catch (prepError) {
          setError(
            prepError instanceof Error
              ? prepError.message
              : "Fichier illisible."
          );
        }
      }
    },
    [attachments.length]
  );

  const undo = useCallback(() => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const previous = stack[stack.length - 1];
      setDraft(previous);
      persist(messages, previous);
      setFlashes([{ kind: "item_updated", label: "Modification annulée" }]);
      return stack.slice(0, -1);
    });
  }, [messages, persist]);

  const restart = useCallback(() => {
    if (!confirmRestart) {
      setConfirmRestart(true);
      setTimeout(() => setConfirmRestart(false), 3500);
      return;
    }
    setConfirmRestart(false);
    if (userId) clearConversation(userId);
    setMessages([
      { role: "assistant", text: GREETING, at: new Date().toISOString() },
    ]);
    setDraft(emptyDraft());
    setUndoStack([]);
    setReviewProposed(false);
    setFlashes([]);
    setError(null);
  }, [confirmRestart, userId]);

  const showSuggestions =
    loaded && messages.every((m) => m.role === "assistant") && !busy;

  const panel = (
    <DraftPanel
      draft={draft}
      progress={progress}
      flashes={flashes}
      onEditItem={(id, patch) =>
        applyLocalChange(
          (current) => ({
            ...current,
            items: current.items.map((item) =>
              item.id === id
                ? {
                    ...item,
                    ...patch,
                    priceConfidence:
                      patch.dailyPrice !== undefined
                        ? "confirmed"
                        : item.priceConfidence,
                    depositConfidence:
                      patch.deposit !== undefined
                        ? "confirmed"
                        : item.depositConfidence,
                    quantityConfidence:
                      patch.quantity !== undefined
                        ? "confirmed"
                        : item.quantityConfidence,
                  }
                : item
            ),
          }),
          "Bien modifié",
          id
        )
      }
      onDeleteItem={(id) =>
        applyLocalChange(
          (current) => ({
            ...current,
            items: current.items.filter((item) => item.id !== id),
          }),
          "Bien supprimé"
        )
      }
      onDuplicateItem={(id) =>
        applyLocalChange(
          (current) => {
            const source = current.items.find((item) => item.id === id);
            if (!source) return current;
            const copy: DraftItem = {
              ...source,
              id: nextTempId("i", current.items),
              name: `${source.name} (copie)`,
              confirmed: false,
            };
            return { ...current, items: [...current.items, copy] };
          },
          "Bien dupliqué"
        )
      }
      onConfirmItem={(id) =>
        applyLocalChange(
          (current) => ({
            ...current,
            items: current.items.map((item) =>
              item.id === id
                ? {
                    ...item,
                    confirmed: true,
                    priceConfidence: "confirmed",
                    depositConfidence: "confirmed",
                    quantityConfidence: "confirmed",
                  }
                : item
            ),
          }),
          "Bien confirmé",
          id
        )
      }
    />
  );

  return (
    <div>
      {/* Onglets mobiles */}
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-pc-deep/[0.05] p-1 lg:hidden">
        {(
          [
            { id: "chat", label: "Conversation", icon: MessageCircle },
            { id: "draft", label: "Activité détectée", icon: ListChecks },
          ] as const
        ).map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => {
              setTab(entry.id);
              if (entry.id === "draft") setUnseenChanges(false);
            }}
            className={cn(
              "relative flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition",
              tab === entry.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground"
            )}
          >
            <entry.icon className="size-4" aria-hidden />
            {entry.label}
            {entry.id === "draft" && (
              <>
                {draft.items.length > 0 && (
                  <span className="rounded-full bg-pc-turquoise/15 px-1.5 text-xs font-semibold text-pc-lagoon">
                    {draft.items.length}
                  </span>
                )}
                {unseenChanges && tab === "chat" && (
                  <span
                    className="absolute right-2 top-1.5 size-2 animate-pulse rounded-full bg-pc-coral"
                    aria-hidden
                  />
                )}
              </>
            )}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* Conversation */}
        <section
          className={cn("min-w-0", tab !== "chat" && "hidden lg:block")}
          aria-label="Conversation avec l’agent"
        >
          <div className="flex h-[72svh] min-h-[480px] flex-col rounded-2xl bg-card shadow-sm shadow-pc-deep/[0.04] ring-1 ring-pc-deep/[0.08]">
            <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
              <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-pc-lagoon to-pc-turquoise text-white">
                <Sparkles className="size-4" aria-hidden />
              </span>
              <p className="text-sm font-semibold text-foreground">
                Agent IA d’onboarding
              </p>
              {agentMode === "dev" && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200">
                  mode développement — agent simulé, sans IA
                </span>
              )}
              <div className="ml-auto flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={undo}
                  disabled={undoStack.length === 0}
                  className="h-8 px-2 text-xs text-muted-foreground"
                  aria-label="Annuler la dernière modification"
                >
                  <Undo2 className="size-3.5" aria-hidden />
                  Annuler
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={restart}
                  className={cn(
                    "h-8 px-2 text-xs",
                    confirmRestart
                      ? "text-rose-600 hover:text-rose-700"
                      : "text-muted-foreground"
                  )}
                >
                  <RotateCcw className="size-3.5" aria-hidden />
                  {confirmRestart ? "Confirmer ?" : "Recommencer"}
                </Button>
              </div>
            </div>

            <div
              ref={scrollRef}
              className="flex-1 space-y-3 overflow-y-auto p-4"
            >
              {messages.map((message, i) => (
                <motion.div
                  key={`${message.at}-${i}`}
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className={
                    message.role === "user"
                      ? "flex justify-end"
                      : "flex justify-start"
                  }
                >
                  <div
                    className={cn(
                      "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm",
                      message.role === "user"
                        ? "rounded-br-md bg-gradient-to-br from-pc-lagoon to-pc-turquoise text-white"
                        : "rounded-bl-md bg-background text-foreground ring-1 ring-pc-deep/[0.08]"
                    )}
                  >
                    {message.attachments && message.attachments.length > 0 && (
                      <span
                        className={cn(
                          "flex flex-wrap gap-1.5",
                          message.text && "mb-1.5"
                        )}
                      >
                        {message.attachments.map((attachment, j) => (
                          <AttachmentChip
                            key={`${attachment.name}-${j}`}
                            kind={attachment.kind}
                            name={attachment.name}
                          />
                        ))}
                      </span>
                    )}
                    {message.text}
                  </div>
                </motion.div>
              ))}

              {busy && (
                <ThinkingIndicator
                  label={
                    analyzingDoc
                      ? "L’agent analyse votre document…"
                      : "L’agent réfléchit…"
                  }
                />
              )}

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/70 px-3.5 py-2.5 text-sm text-rose-700">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <div className="flex-1">
                    <p>{error}</p>
                    {lastFailed && (
                      <button
                        type="button"
                        onClick={() => void send("", { retry: lastFailed })}
                        className="mt-1 text-xs font-semibold underline underline-offset-2"
                      >
                        Réessayer
                      </button>
                    )}
                  </div>
                </div>
              )}

              {showReviewPrompt && canReview && !busy && (
                <motion.div
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => onReview(draft)}
                      className="bg-gradient-to-r from-pc-lagoon to-pc-turquoise font-semibold text-white shadow-md shadow-pc-lagoon/25 hover:brightness-105"
                    >
                      Vérifier mon activité
                      <ArrowRight className="size-4" aria-hidden />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setReviewDismissed(true)}
                    >
                      Continuer à compléter
                    </Button>
                  </div>
                </motion.div>
              )}

              <div ref={endRef} />
            </div>

            {/* Zone de saisie ou état non configuré */}
            {agentMode === "unconfigured" ? (
              <div className="border-t border-border/70 p-4">
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                    <KeyRound className="size-4.5 text-amber-700" aria-hidden />
                  </span>
                  <div className="text-sm">
                    <p className="font-semibold text-amber-900">
                      L’agent IA doit être configuré
                    </p>
                    <p className="mt-1 text-amber-800">
                      Ajoutez une clé côté serveur (variables{" "}
                      <code className="rounded bg-amber-100 px-1">
                        AI_PROVIDER
                      </code>{" "}
                      et{" "}
                      <code className="rounded bg-amber-100 px-1">
                        ANTHROPIC_API_KEY
                      </code>
                      ) puis rechargez. La clé ne quitte jamais le serveur.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onUseTextMethod}
                      className="mt-2.5"
                    >
                      Utiliser « Je colle mes annonces » en attendant
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border-t border-border/70 p-3">
                {showSuggestions && (
                  <div className="mb-2 flex flex-wrap gap-1.5 px-1">
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => void send(suggestion)}
                        className="rounded-full border border-pc-lagoon/25 bg-pc-turquoise/[0.06] px-3 py-1.5 text-xs font-medium text-pc-lagoon transition hover:bg-pc-turquoise/15"
                      >
                        {suggestion}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 rounded-full border border-pc-lagoon/25 bg-pc-turquoise/[0.06] px-3 py-1.5 text-xs font-medium text-pc-lagoon transition hover:bg-pc-turquoise/15"
                    >
                      <Paperclip className="size-3.5" aria-hidden />
                      J’envoie une photo ou un PDF
                    </button>
                  </div>
                )}
                {attachments.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5 px-1">
                    {attachments.map((attachment, i) => {
                      const Icon =
                        attachment.kind === "pdf" ? FileText : Camera;
                      return (
                        <span
                          key={`${attachment.name}-${i}`}
                          className="flex items-center gap-1.5 rounded-full border border-pc-lagoon/25 bg-pc-turquoise/[0.08] py-1 pl-2.5 pr-1.5 text-xs font-medium text-pc-lagoon"
                        >
                          <Icon className="size-3.5 shrink-0" aria-hidden />
                          <span className="max-w-40 truncate">
                            {attachment.name}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setAttachments((current) =>
                                current.filter((_, j) => j !== i)
                              )
                            }
                            className="rounded-full p-0.5 transition hover:bg-pc-turquoise/20"
                            aria-label={`Retirer ${attachment.name}`}
                          >
                            <X className="size-3" aria-hidden />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      void addFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-lg"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={
                      busy || !loaded || attachments.length >= MAX_ATTACHMENTS
                    }
                    className="text-muted-foreground"
                    aria-label="Joindre une photo ou un PDF"
                  >
                    <Paperclip className="size-4.5" aria-hidden />
                  </Button>
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send(input);
                      }
                    }}
                    rows={2}
                    maxLength={12_000}
                    placeholder="Décrivez votre activité, collez une annonce, ou joignez une photo / un PDF…"
                    className="max-h-40 flex-1 resize-none bg-card"
                    aria-label="Votre message"
                    disabled={busy || !loaded}
                  />
                  <Button
                    type="button"
                    size="icon-lg"
                    onClick={() => void send(input)}
                    disabled={
                      busy ||
                      (!input.trim() && attachments.length === 0) ||
                      !loaded
                    }
                    className="bg-gradient-to-br from-pc-lagoon to-pc-turquoise text-white shadow-lg shadow-pc-lagoon/25 hover:brightness-105"
                    aria-label="Envoyer"
                  >
                    <Send className="size-4" aria-hidden />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Brouillon vivant */}
        <aside
          className={cn(
            "min-w-0",
            tab !== "draft" && "hidden lg:block",
            "lg:sticky lg:top-20 lg:max-h-[calc(100svh-6rem)] lg:overflow-y-auto lg:pb-4"
          )}
          aria-label="Activité détectée"
        >
          {panel}
          {canReview && (
            <div className="mt-4">
              <Button
                onClick={() => onReview(draft)}
                className={cn(
                  "w-full font-semibold",
                  highlightReview
                    ? "bg-gradient-to-r from-pc-lagoon to-pc-turquoise text-white shadow-lg shadow-pc-lagoon/25 hover:brightness-105"
                    : undefined
                )}
                variant={highlightReview ? "default" : "outline"}
              >
                Vérifier mon activité
                <ArrowRight className="size-4" aria-hidden />
              </Button>
              <p className="mt-1.5 text-center text-xs text-muted-foreground/80">
                Rien n’est créé sans votre validation.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
