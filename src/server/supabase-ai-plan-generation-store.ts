import type { LunchDayLog } from "./ai-lunch-enrichment";
import type { OpenAiWebSearchCall } from "./openai-response";
import { recordGuestEvent } from "./guest-events";
import { GUEST_USAGE_KIND, recordGuestCall } from "./guest-usage-store";
import { guestIdFromPrincipalId } from "./principal";
import { getSupabaseClient } from "./supabase";
import { throwSupabaseError } from "./supabase-errors";

type GenerationRecord = {
  id: number;
};

type GenerationInsert = {
  prompt_version: string;
  preferences_snapshot: Record<string, unknown>;
  candidate_count: number;
  must_see_count: number;
  status?: "running" | "completed" | "failed";
};

type GenerationUpdate = {
  status?: "running" | "completed" | "failed";
  model?: string;
  primary_validation_status?: "valid" | "invalid";
  primary_validation_errors?: string[];
  repair_attempted?: boolean;
  repair_validation_status?: "valid" | "invalid" | "not_attempted";
  repair_validation_errors?: string[];
  generated_place_count?: number;
  generated_day_count?: number;
  duration_ms?: number;
  token_input_count?: number | null;
  token_output_count?: number | null;
  failure_reason?: string | null;
  // Per-day lunch verification outcomes; null when lunch was off or the run
  // was a guest generation (no verification happens there).
  lunch_verification_log?: LunchDayLog[] | null;
  // Web searches the primary call executed ([] = tool attached, none used);
  // null when the tool was never attached (guest generations).
  web_search_calls?: OpenAiWebSearchCall[] | null;
};

export async function createAiPlanGeneration(
  tripId: number,
  principalId: string,
  input: GenerationInsert,
  ipHash: string | null = null,
): Promise<GenerationRecord> {
  // Guest generations keep full cost logging here but carry no auth.users id;
  // their per-guest quota accounting lives in guest_api_usage instead.
  const guestId = guestIdFromPrincipalId(principalId);
  const { data, error } = await getSupabaseClient()
    .from("ai_plan_generations")
    .insert({
      trip_id: tripId,
      created_by_user_id: guestId === null ? principalId : null,
      status: input.status ?? "running",
      prompt_version: input.prompt_version,
      preferences_snapshot: input.preferences_snapshot,
      candidate_count: input.candidate_count,
      must_see_count: input.must_see_count,
    })
    .select("id")
    .single();

  if (error) throwSupabaseError(error);

  if (guestId !== null) {
    await recordGuestCall(guestId, GUEST_USAGE_KIND.AI_GENERATION, ipHash);
    void recordGuestEvent(guestId, "generation_run", { trip_id: tripId });
  }

  return data as GenerationRecord;
}

export async function countUserGenerationsToday(
  userId: string,
): Promise<number> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { count, error } = await getSupabaseClient()
    .from("ai_plan_generations")
    .select("*", { count: "exact", head: true })
    .eq("created_by_user_id", userId)
    .gte("created_at", todayStart.toISOString())
    // A generation only counts against the daily cap if it actually consumed
    // (or is still consuming) OpenAI budget. Failures that never reached token
    // billing — upstream 429s in particular — leave token_input_count NULL and
    // cost nothing, so they must not burn one of the user's daily slots.
    .or("status.neq.failed,token_input_count.not.is.null");

  if (error) throwSupabaseError(error);
  return count ?? 0;
}

export async function updateAiPlanGeneration(
  generationId: number,
  input: GenerationUpdate,
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("ai_plan_generations")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", generationId);

  if (error) throwSupabaseError(error);
}
