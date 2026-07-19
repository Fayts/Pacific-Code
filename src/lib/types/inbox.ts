// Types du module Agent IA commercial multicanal : connexions de canaux,
// boîte de réception unifiée et réglages de l'agent.
// Mêmes conventions snake_case que les types Supabase pour préparer les
// futures tables (channel_connections, inbox_conversations, inbox_messages,
// agent_settings) sans rien changer côté UI/services.

/** Canal d'origine d'une conversation. */
export type ChannelKind = "messenger" | "gmail" | "whatsapp" | "form";

export type ChannelStatus = "connected" | "disconnected";

export type ChannelConnection = {
  id: string;
  organization_id: string;
  channel: ChannelKind;
  status: ChannelStatus;
  /** Nom affiché : Page Facebook, adresse Gmail, numéro WhatsApp… */
  display_name: string | null;
  connected_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ConversationStatus =
  | "new"
  | "auto_replied"
  | "replied"
  | "transferred"
  | "ignored";

export type InboxConversation = {
  id: string;
  organization_id: string;
  channel: ChannelKind;
  customer_name: string;
  /** Email, téléphone ou identifiant du canal. */
  customer_contact: string | null;
  /** Client du carnet si identifié. */
  customer_id: string | null;
  /** Objet (emails) — null pour les messageries. */
  subject: string | null;
  status: ConversationStatus;
  last_message_at: string;
  created_at: string;
  updated_at: string;
};

export type MessageAuthor = "customer" | "agent" | "user";

export type InboxMessage = {
  id: string;
  organization_id: string;
  conversation_id: string;
  direction: "inbound" | "outbound";
  author: MessageAuthor;
  body: string;
  created_at: string;
};

export type AgentMode = "assisted" | "auto";

export type AgentTone = "professional" | "warm" | "concise" | "premium";

export type AgentPermissions = {
  read_messages: boolean;
  detect_requests: boolean;
  check_availability: boolean;
  compute_prices: boolean;
  prepare_replies: boolean;
  auto_reply_simple: boolean;
  send_form: boolean;
};

export type AgentSettings = {
  organization_id: string;
  mode: AgentMode;
  tone: AgentTone;
  /** Signature ajoutée à la fin des réponses. */
  signature: string;
  /**
   * Informations pratiques (horaires, retrait, livraison…) que l'agent est
   * autorisé à citer. Il ne doit JAMAIS inventer ces informations.
   */
  practical_info: string;
  permissions: AgentPermissions;
  activated_at: string | null;
  updated_at: string;
};
