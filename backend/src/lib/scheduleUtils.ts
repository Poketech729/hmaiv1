/**
 * Generates an array of Date objects representing scheduled dose times.
 *
 * @param startDate   ISO date string (e.g. "2025-01-15")
 * @param endDate     Optional ISO date string for prescription end
 * @param times       Array of "HH:MM" strings (e.g. ["08:00", "20:00"])
 * @param daysAhead   How many days from startDate to generate (default 7)
 */
export function generateScheduleDates(
  startDate: string,
  endDate: string | undefined,
  times: string[],
  daysAhead = 7
): Date[] {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : null;
  const dates: Date[] = [];

  for (let day = 0; day < daysAhead; day++) {
    const currentDay = new Date(start);
    currentDay.setDate(start.getDate() + day);

    // Don't generate beyond end date
    if (end && currentDay > end) break;

    for (const time of times) {
      const [hours, minutes] = time.split(":").map(Number);
      const scheduledAt = new Date(currentDay);
      scheduledAt.setHours(hours, minutes, 0, 0);
      dates.push(scheduledAt);
    }
  }

  return dates;
}

/**
 * Extends schedule entries for a prescription by generating
 * the next N days from the given date.
 */
export function generateNextDays(
  fromDate: Date,
  endDate: Date | null,
  times: string[],
  days = 7
): Date[] {
  const dates: Date[] = [];

  for (let i = 0; i < days; i++) {
    const day = new Date(fromDate);
    day.setDate(fromDate.getDate() + i);

    if (endDate && day > endDate) break;

    for (const time of times) {
      const [hours, minutes] = time.split(":").map(Number);
      const slot = new Date(day);
      slot.setHours(hours, minutes, 0, 0);
      dates.push(slot);
    }
  }

  return dates;
}
