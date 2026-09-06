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

export function expandOrCollapseAllDates(
  current: ReadonlySet<string>,
  dayDates: ReadonlyArray<string>,
): Set<string> {
  const next = new Set(current);
  const allCollapsed = [...dayDates].every((date) => next.has(date));

  for (const date of dayDates) {
    if (allCollapsed) {
      next.delete(date);
    } else {
      next.add(date);
    }
  }

  return next;
}
