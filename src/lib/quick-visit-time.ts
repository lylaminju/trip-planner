import { formatVisitTime, parseVisitTime } from "./visit-time";

export const DEFAULT_QUICK_VISIT_TIME = "09:00";

export function normalizeQuickVisitTime(value: string | null): string | null {
  const parsed = parseVisitTime(value?.trim() ?? null);

  return parsed === null ? null : formatVisitTime(parsed);
}
