const SHEET_ID = import.meta.env.VITE_SHEET_ID;
const API_KEY = import.meta.env.VITE_API_KEY;
const BASE = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`;

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────
let oauthToken = null;

export function setOAuthToken(token) {
  oauthToken = token;
}

function buildUrl(path, params = {}) {
  // Ensure path starts correctly.
  // 1. If path is empty, it's the base spreadsheet URL (no trailing slash).
  // 2. If path starts with ':', it's an action like :batchUpdate (no slash).
  // 3. Otherwise, it's a sub-resource like /values (needs a slash).
  let finalPath = path;
  if (path && !path.startsWith('/') && !path.startsWith(':')) {
    finalPath = '/' + path;
  }
  
  const url = new URL(`${BASE}${finalPath}`);
  
  // Only append API key if we don't have an OAuth token
  if (!oauthToken && API_KEY) {
    url.searchParams.set('key', API_KEY);
  }
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) {
      url.searchParams.set(k, v);
    }
  });
  return url.toString();
}

async function apiFetch(url, options = {}) {
  const headers = { ...options.headers };
  if (oauthToken) {
    headers.Authorization = `Bearer ${oauthToken}`;
  }
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
  
  try {
    const res = await fetch(url, { ...options, headers, signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      let msg = `HTTP ${res.status} on ${url}`;
      try {
        const body = await res.json();
        msg = body?.error?.message || msg;
      } catch (_) {}
      throw new Error(msg);
    }
    return res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw new Error('Request timed out (15s). Please check your connection.');
    throw err;
  }
}

// ──────────────────────────────────────────────────────────────
// READ
// ──────────────────────────────────────────────────────────────

/**
 * Fetch all rows from "Expenses" tab.
 * Returns array of objects: { rowIndex, id, timestamp, item, category, price, type, monthCycle }
 */
export async function fetchExpenses() {
  const url = buildUrl('/values/Expenses!A:G', { valueRenderOption: 'UNFORMATTED_VALUE' });
  const data = await apiFetch(url);
  const rows = data.values || [];
  // row[0] is header
  return rows.slice(1).map((row, i) => ({
    rowIndex: i + 2, // 1-based, skip header
    id: row[0] ?? '',
    timestamp: row[1] ?? '',
    item: row[2] ?? '',
    category: row[3] ?? '',
    price: parseFloat(row[4]) || 0,
    type: row[5] ?? 'expense',
    monthCycle: row[6] ?? '',
  }));
}

/**
 * Fetch all rows from "Subscriptions" tab.
 * Returns array of objects: { rowIndex, id, item, category, price, active }
 */
export async function fetchSubscriptions() {
  const url = buildUrl('/values/Subscriptions!A:E', { valueRenderOption: 'UNFORMATTED_VALUE' });
  const data = await apiFetch(url);
  const rows = data.values || [];
  return rows.slice(1).map((row, i) => ({
    rowIndex: i + 2,
    id: row[0] ?? '',
    item: row[1] ?? '',
    category: row[2] ?? '',
    price: parseFloat(row[3]) || 0,
    active: String(row[4]).toUpperCase() === 'TRUE',
  }));
}

// ──────────────────────────────────────────────────────────────
// APPEND (Expenses)
// ──────────────────────────────────────────────────────────────

/**
 * Append a new expense row.
 * @param {object} expense - { id, timestamp, item, category, price, type, monthCycle }
 */
export async function appendExpense(expense) {
  const url = buildUrl('/values/Expenses!A:G:append', {
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
  });
  const body = {
    values: [[
      expense.id,
      expense.timestamp,
      expense.item,
      expense.category,
      expense.price,
      expense.type,
      expense.monthCycle,
    ]],
  };
  return apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ──────────────────────────────────────────────────────────────
// UPDATE (Expenses)
// ──────────────────────────────────────────────────────────────

/**
 * Update a specific expense row by its 1-based row index in the sheet.
 */
export async function updateExpense(rowIndex, expense) {
  const range = `Expenses!A${rowIndex}:G${rowIndex}`;
  const url = buildUrl(`/values/${encodeURIComponent(range)}`, {
    valueInputOption: 'USER_ENTERED',
  });
  const body = {
    range,
    values: [[
      expense.id,
      expense.timestamp,
      expense.item,
      expense.category,
      expense.price,
      expense.type,
      expense.monthCycle,
    ]],
  };
  return apiFetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ──────────────────────────────────────────────────────────────
// DELETE (Expenses) — clears the row content
// ──────────────────────────────────────────────────────────────

/**
 * Delete a specific expense row by its 1-based row index.
 * Uses batchUpdate to delete the row entirely (shift rows up).
 */
export async function deleteExpense(rowIndex) {
  // We need the sheet ID (gid) for batchUpdate. Fetch it first.
  const sheetGid = await getSheetGid('Expenses');
  const url = buildUrl(':batchUpdate');
  const body = {
    requests: [{
      deleteDimension: {
        range: {
          sheetId: sheetGid,
          dimension: 'ROWS',
          startIndex: rowIndex - 1, // 0-based
          endIndex: rowIndex,       // exclusive
        },
      },
    }],
  };
  return apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ──────────────────────────────────────────────────────────────
// APPEND (Subscriptions)
// ──────────────────────────────────────────────────────────────

export async function appendSubscription(sub) {
  const url = buildUrl('/values/Subscriptions!A:E:append', {
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
  });
  const body = {
    values: [[sub.id, sub.item, sub.category, sub.price, sub.active ? 'TRUE' : 'FALSE']],
  };
  return apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ──────────────────────────────────────────────────────────────
// UPDATE (Subscriptions)
// ──────────────────────────────────────────────────────────────

export async function updateSubscription(rowIndex, sub) {
  const range = `Subscriptions!A${rowIndex}:E${rowIndex}`;
  const url = buildUrl(`/values/${encodeURIComponent(range)}`, {
    valueInputOption: 'USER_ENTERED',
  });
  const body = {
    range,
    values: [[sub.id, sub.item, sub.category, sub.price, sub.active ? 'TRUE' : 'FALSE']],
  };
  return apiFetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ──────────────────────────────────────────────────────────────
// DELETE (Subscriptions)
// ──────────────────────────────────────────────────────────────

export async function deleteSubscription(rowIndex) {
  const sheetGid = await getSheetGid('Subscriptions');
  const url = buildUrl(':batchUpdate');
  const body = {
    requests: [{
      deleteDimension: {
        range: {
          sheetId: sheetGid,
          dimension: 'ROWS',
          startIndex: rowIndex - 1,
          endIndex: rowIndex,
        },
      },
    }],
  };
  return apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ──────────────────────────────────────────────────────────────
// Internal: fetch sheet metadata to get gid by name
// ──────────────────────────────────────────────────────────────
const _gidCache = {};
async function getSheetGid(sheetName) {
  if (_gidCache[sheetName] !== undefined) return _gidCache[sheetName];
  // Get spreadsheet metadata to find sheet GIDs
  const url = buildUrl('', { fields: 'sheets(properties(title,sheetId))' });
  const data = await apiFetch(url);
  for (const sheet of data.sheets || []) {
    _gidCache[sheet.properties.title] = sheet.properties.sheetId;
  }
  if (_gidCache[sheetName] === undefined) throw new Error(`Sheet "${sheetName}" not found`);
  return _gidCache[sheetName];
}
