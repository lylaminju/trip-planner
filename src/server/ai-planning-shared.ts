import type { AiDestinationCandidate } from "@/lib/types";

import {
  AiGenerationRateLimitError,
  AiPlannerConfigError,
  AiUpstreamRateLimitError,
} from "./errors";
import { recordGuestEvent } from "./guest-events";
import {
  countAllGuestCallsToday,
  countGuestCallsToday,
  GUEST_AI_GENERATION_DAILY_LIMIT,
  GUEST_AI_GENERATION_GLOBAL_DAILY_CAP,
  GUEST_USAGE_KIND,
} from "./guest-usage-store";
import { guestIdFromPrincipalId } from "./principal";
import { countUserGenerationsToday } from "./supabase-ai-plan-application-service";

const AI_GENERATION_DAILY_LIMIT = 30;

export const DESTINATION_NOT_PLANNABLE_MESSAGE =
  "AI planning needs a trip destination first.";

// Guests are bounded per cookie and by the demo-wide cap that bounds
// worst-case OpenAI spend; invited users keep the per-account daily limit.
export async function assertAiGenerationQuota(
  principalId: string,
): Promise<void> {
  const guestId = guestIdFromPrincipalId(principalId);

  if (guestId === null) {
    const todayCount = await countUserGenerationsToday(principalId);
    if (todayCount >= AI_GENERATION_DAILY_LIMIT) {
      throw new AiGenerationRateLimitError(
        "Daily AI generation limit reached. Please try again tomorrow.",
      );
    }
    return;
  }

  const guestCount = await countGuestCallsToday(
    guestId,
    GUEST_USAGE_KIND.AI_GENERATION,
  );
  if (guestCount >= GUEST_AI_GENERATION_DAILY_LIMIT) {
    void recordGuestEvent(guestId, "limit_hit", {
      kind: GUEST_USAGE_KIND.AI_GENERATION,
      scope: "guest",
    });
    throw new AiGenerationRateLimitError(
      "Daily AI generation limit reached for this guest session. Sign in for a higher limit.",
    );
  }

  const globalCount = await countAllGuestCallsToday(
    GUEST_USAGE_KIND.AI_GENERATION,
  );
  if (globalCount >= GUEST_AI_GENERATION_GLOBAL_DAILY_CAP) {
    void recordGuestEvent(guestId, "limit_hit", {
      kind: GUEST_USAGE_KIND.AI_GENERATION,
      scope: "global",
    });
    throw new AiGenerationRateLimitError(
      "The guest demo's AI budget is used up for today. Sign in for full access.",
    );
  }
}

export function openAiPlannerConfig(): { apiKey: string; model: string } {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new AiPlannerConfigError("OpenAI API key is not configured.");
  }
  const model = process.env.OPENAI_AI_PLANNER_MODEL?.trim();
  if (!model) {
    throw new AiPlannerConfigError(
      "OpenAI AI planner model is not configured.",
    );
  }

  return {
    apiKey,
    model,
  };
}

export function candidateIdSet(
  candidates: AiDestinationCandidate[],
): ReadonlySet<number> {
  return new Set(candidates.map((candidate) => candidate.id));
}

// Upstream rate-limit errors carry a deliberately generic user-facing message;
// keep OpenAI's diagnostics (which limit, tokens requested, retry hint) in the
// logged failure reason so limit issues stay debuggable.
export function generationFailureReason(error: unknown): string {
  if (error instanceof AiUpstreamRateLimitError && error.upstreamDetail) {
    return `${error.message} (${error.upstreamDetail})`;
  }
  return error instanceof Error ? error.message : "Unknown error";
}
