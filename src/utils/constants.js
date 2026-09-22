// --- Dynamic Salary & Pay Day (persisted in localStorage) ---

const SALARY_KEY = 'moneytrack_salary';
const PAYDAY_KEY = 'moneytrack_payday';

const DEFAULT_SALARY = 5000;
const DEFAULT_PAYDAY = 7; // day of month when salary arrives

/**
 * Get the current salary (from localStorage, or default).
 */
export function getSalary() {
  const stored = localStorage.getItem(SALARY_KEY);
  if (stored !== null) {
    const n = parseFloat(stored);
    if (!isNaN(n) && n >= 0) return n;
  }
  return DEFAULT_SALARY;
}

/**
 * Set (persist) the salary value.
 */
export function setSalary(value) {
  const n = parseFloat(value);
  if (isNaN(n) || n < 0) throw new Error('Salariul trebuie să fie un număr pozitiv.');
  localStorage.setItem(SALARY_KEY, String(n));
  return n;
}

/**
 * Get the pay day (1-31). This is the day of the month when the salary cycle starts.
 */
export function getPayDay() {
  const stored = localStorage.getItem(PAYDAY_KEY);
  if (stored !== null) {
    const d = parseInt(stored, 10);
    if (!isNaN(d) && d >= 1 && d <= 31) return d;
  }
  return DEFAULT_PAYDAY;
}

/**
 * Set (persist) the pay day (1-31).
 */
export function setPayDay(value) {
  const d = parseInt(value, 10);
  if (isNaN(d) || d < 1 || d > 31) throw new Error('Ziua salariului trebuie să fie între 1 și 31.');
  localStorage.setItem(PAYDAY_KEY, String(d));
  return d;
}

// Legacy compat — keep a static SALARY export for any code that still uses it
export const SALARY = DEFAULT_SALARY;
