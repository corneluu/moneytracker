// --- Dynamic Salary & Pay Day (persisted per user in localStorage) ---

const DEFAULT_SALARY = 5000;
const DEFAULT_PAYDAY = 7; // day of month when salary arrives

function getKey(baseKey, userEmail) {
  if (userEmail && typeof userEmail === 'string') {
    const cleanEmail = userEmail.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    return `${baseKey}_${cleanEmail}`;
  }
  return baseKey;
}

/**
 * Get the current salary (from localStorage, or default).
 */
export function getSalary(userEmail) {
  const key = getKey('moneytrack_salary', userEmail);
  const stored = localStorage.getItem(key) || localStorage.getItem('moneytrack_salary');
  if (stored !== null) {
    const n = parseFloat(stored);
    if (!isNaN(n) && n >= 0) return n;
  }
  return DEFAULT_SALARY;
}

/**
 * Set (persist) the salary value for a user.
 */
export function setSalary(value, userEmail) {
  const n = parseFloat(value);
  if (isNaN(n) || n < 0) throw new Error('Salariul trebuie să fie un număr pozitiv.');
  const key = getKey('moneytrack_salary', userEmail);
  localStorage.setItem(key, String(n));
  return n;
}

/**
 * Get the pay day (1-31). This is the day of the month when the salary cycle starts.
 */
export function getPayDay(userEmail) {
  const key = getKey('moneytrack_payday', userEmail);
  const stored = localStorage.getItem(key) || localStorage.getItem('moneytrack_payday');
  if (stored !== null) {
    const d = parseInt(stored, 10);
    if (!isNaN(d) && d >= 1 && d <= 31) return d;
  }
  return DEFAULT_PAYDAY;
}

/**
 * Set (persist) the pay day (1-31).
 */
export function setPayDay(value, userEmail) {
  const d = parseInt(value, 10);
  if (isNaN(d) || d < 1 || d > 31) throw new Error('Ziua salariului trebuie să fie între 1 și 31.');
  const key = getKey('moneytrack_payday', userEmail);
  localStorage.setItem(key, String(d));
  return d;
}

/**
 * Check if the user has explicitly set their salary & payday.
 */
export function isUserSalaryConfigured(userEmail) {
  const salaryKey = getKey('moneytrack_salary', userEmail);
  return localStorage.getItem(salaryKey) !== null;
}

// Legacy compat — keep a static SALARY export for any legacy code
export const SALARY = DEFAULT_SALARY;
