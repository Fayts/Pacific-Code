import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/types/database";

// Journalisation des actions importantes (best effort : ne bloque jamais
// l'action principale si l'insertion échoue).
export async function logActivity(
  supabase: SupabaseClient<Database>,
  params: {
    organizationId: string;
    userId: string;
    action: string;
    entityType?: string;
    entityId?: string;
    metadata?: Json;
  }
): Promise<void> {
  const { error } = await supabase.from("activity_logs").insert({
    organization_id: params.organizationId,
    user_id: params.userId,
    action: params.action,
    entity_type: params.entityType ?? null,
    entity_id: params.entityId ?? null,
    metadata: params.metadata ?? {},
  });
  if (error) {
    console.error("activity_logs insert failed:", error.message);
  }
}
