/**
 * Calculate the MonthCycle (salary cycle label "YYYY-MM") from an ISO timestamp.
 * Rule: cycle runs from the 7th 00:00 of month M to the 6th 23:59 of month M+1.
 * If day >= 7 → cycle is "YYYY-MM" of that month.
 * If day < 7  → cycle is "YYYY-MM" of the PREVIOUS month.
 */
export function getMonthCycle(isoTimestamp) {
  const date = new Date(isoTimestamp);
  if (isNaN(date.getTime())) return 'Invalid';
  const day = date.getDate();

  if (day >= 7) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  } else {
    // Use the previous month
    const prev = new Date(date.getFullYear(), date.getMonth() - 1, 1);
    const year = prev.getFullYear();
    const month = String(prev.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
}

/**
 * Get the current salary cycle label "YYYY-MM" based on today's date.
 */
export function getCurrentCycle() {
  return getMonthCycle(new Date().toISOString());
}

/**
 * Get the start (Date) of a cycle given a "YYYY-MM" label.
 * Start = 7th of that month at 00:00 local time.
 */
export function getCycleStart(cycleLabel) {
  if (!cycleLabel || typeof cycleLabel !== 'string' || !cycleLabel.includes('-')) {
    return new Date(); // Fallback to now
  }
  const [year, month] = cycleLabel.split('-').map(Number);
  if (isNaN(year) || isNaN(month)) return new Date();
  return new Date(year, month - 1, 7, 0, 0, 0, 0);
}

/**
 * Get the end (Date) of a cycle given a "YYYY-MM" label.
 * End = 6th of the NEXT month at 23:59:59 local time.
 */
export function getCycleEnd(cycleLabel) {
  if (!cycleLabel || typeof cycleLabel !== 'string' || !cycleLabel.includes('-')) {
    return new Date(); // Fallback to now
  }
  const [year, month] = cycleLabel.split('-').map(Number);
  if (isNaN(year) || isNaN(month)) return new Date();
  // Next month (month is 0-indexed, we pass month as-is which is already next month index)
  return new Date(year, month, 6, 23, 59, 59, 999);
}

/**
 * Format a cycle label "YYYY-MM" into a human-readable range string.
 * e.g. "7 Apr - 6 May"
 */
export function formatCycleRange(cycleLabel) {
  if (!cycleLabel || cycleLabel === 'Invalid') return 'Unknown Cycle';
  const start = getCycleStart(cycleLabel);
  const end = getCycleEnd(cycleLabel);
  
  if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) return 'Invalid Cycle';
  
  const opts = { day: 'numeric', month: 'short' };
  const startStr = start.toLocaleDateString('en-GB', opts);
  const endStr = end.toLocaleDateString('en-GB', opts);
  return `${startStr} – ${endStr}`;
}

/**
 * Returns true if a cycle label represents a COMPLETED cycle
 * (its end date is strictly before now).
 */
export function isCycleCompleted(cycleLabel) {
  return getCycleEnd(cycleLabel) < new Date();
}

/**
 * Get the ISO string for the start of the current cycle (7th 00:00 local time).
 */
export function getCurrentCycleStartISO() {
  const cycle = getCurrentCycle();
  return getCycleStart(cycle).toISOString();
}

/**
 * Format a datetime-local string default value (local time, no seconds).
 */
export function localDatetimeDefault() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/**
 * Get the previous cycle label "YYYY-MM" given a current label.
 */
export function getPreviousCycle(cycleLabel) {
  if (!cycleLabel || !cycleLabel.includes('-')) return null;
  const [year, month] = cycleLabel.split('-').map(Number);
  // months are 0-indexed in JS Date. 
  // If month is 4 (April), we want March (index 2). 
  // current month index is month-1 (3). previous is month-2 (2).
  const date = new Date(year, month - 2, 1);
  const prevYear = date.getFullYear();
  const prevMonth = String(date.getMonth() + 1).padStart(2, '0');
  return `${prevYear}-${prevMonth}`;
}
