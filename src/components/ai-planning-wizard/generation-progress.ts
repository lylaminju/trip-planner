// Determinate "trickle" bar for the AI generation wait. The generation is a
// single blocking request with no true progress signal, so this is a
// time-based estimate: it eases toward a ceiling and deliberately never
// reaches 100%, since the screen only unmounts once generation actually
// finishes. It reflects elapsed time on an easing curve, not real API speed.
export const GENERATION_PROGRESS_CEILING = 0.92;
export const GENERATION_PROGRESS_TAU_MS = 20000;
export const GENERATION_PROGRESS_TICK_MS = 250;

// Eases from 0 toward the ceiling on an exponential curve: quick early, then
// asymptotically slowing as it nears the cap. Always returns < ceiling, so the
// bar can never imply completion before the itinerary is ready.
export function trickleProgress(elapsedMs: number): number {
  const elapsed = Math.max(0, elapsedMs);
  return (
    GENERATION_PROGRESS_CEILING *
    (1 - Math.exp(-elapsed / GENERATION_PROGRESS_TAU_MS))
  );
}
