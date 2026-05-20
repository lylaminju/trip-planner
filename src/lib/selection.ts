export function toggleSelectedId(currentId: number | null, nextId: number): number | null {
  return currentId === nextId ? null : nextId;
}
