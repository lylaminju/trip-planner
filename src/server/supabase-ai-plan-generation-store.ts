import { getSupabaseClient } from "./supabase";

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
};

export async function createAiPlanGeneration(
  tripId: number,
  input: GenerationInsert,
): Promise<GenerationRecord> {
  const { data, error } = await getSupabaseClient()
    .from("ai_plan_generations")
    .insert({
      trip_id: tripId,
      status: input.status ?? "running",
      prompt_version: input.prompt_version,
      preferences_snapshot: input.preferences_snapshot,
      candidate_count: input.candidate_count,
      must_see_count: input.must_see_count,
    })
    .select("id")
    .single();

  if (error) throwSupabaseError(error);
  return data as GenerationRecord;
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

function throwSupabaseError(error: { message: string }): never {
  throw new Error(`Supabase query failed: ${error.message}`);
}
