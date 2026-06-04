export function toggleCollapsedDate(
  current: ReadonlySet<string>,
  date: string,
): Set<string> {
  const next = new Set(current);

  if (next.has(date)) {
    next.delete(date);
  } else {
    next.add(date);
  }

  return next;
}
