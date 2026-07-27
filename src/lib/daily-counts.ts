// Day-bucketed count helpers shared by the admin dashboard aggregation stores.

export type DailyCount = { date: string; count: number };

// Start of the UTC day `days - 1` days ago, so the window includes today.
export function historyWindowStart(days: number): Date {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - days + 1);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

export function generateDateRange(start: Date, days: number): string[] {
  const dates: string[] = [];
  const current = new Date(start);
  for (let i = 0; i < days; i++) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

export function aggregateByDay(timestamps: string[], dates: string[]): DailyCount[] {
  const countByDate = new Map<string, number>();
  for (const ts of timestamps) {
    const date = ts.slice(0, 10);
    countByDate.set(date, (countByDate.get(date) ?? 0) + 1);
  }
  return dates.map((date) => ({ date, count: countByDate.get(date) ?? 0 }));
}
