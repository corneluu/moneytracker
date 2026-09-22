import { logSystemError } from './discordLogger.js';

const DEFAULT_SHEET_ID = import.meta.env.VITE_SHEET_ID || '';
const API_KEY = import.meta.env.VITE_API_KEY || '';

function getSheetKey(userEmail) {
  if (userEmail && typeof userEmail === 'string') {
    const cleanEmail = userEmail.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    return `moneytrack_custom_sheet_id_${cleanEmail}`;
  }
  return 'moneytrack_custom_sheet_id';
}

export function getActiveSheetId(userEmail) {
  const key = getSheetKey(userEmail);
  return localStorage.getItem(key) || localStorage.getItem('moneytrack_custom_sheet_id') || DEFAULT_SHEET_ID;
}

export function isUserSheetConfigured(userEmail) {
  const key = getSheetKey(userEmail);
  return localStorage.getItem(key) !== null;
}

export function setCustomSheetId(input, userEmail) {
  if (!input || !input.trim()) throw new Error('Te rugăm să introduci un ID sau link valid de Google Sheet.');
  const trimmed = input.trim();
  let extractedId = trimmed;

  // Extract ID from URL if full URL is pasted
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch && urlMatch[1]) {
    extractedId = urlMatch[1];
  }

  const key = getSheetKey(userEmail);
  localStorage.setItem(key, extractedId);
  return extractedId;
}

export function resetCustomSheetId(userEmail) {
  const key = getSheetKey(userEmail);
  localStorage.removeItem(key);
  return DEFAULT_SHEET_ID;
}

export function getGoogleSheetUrl(userEmail) {
  const currentId = getActiveSheetId(userEmail);
  if (!currentId) return 'https://docs.google.com/spreadsheets';
  return `https://docs.google.com/spreadsheets/d/${currentId}/edit`;
}

/**
 * 1-Click Auto Create Google Sheet in user's personal Google Drive
 */
export async function createAutoGoogleSheet(userEmail) {
  const url = 'https://sheets.googleapis.com/v4/spreadsheets';
  const body = {
    properties: {
      title: 'MoneyTrack — Baza Mea De Date',
    },
    sheets: [
      {
        properties: { title: 'Expenses' },
        data: [{
          rowData: [{
            values: [
              { userEnteredValue: { stringValue: 'ID' } },
              { userEnteredValue: { stringValue: 'Timestamp' } },
              { userEnteredValue: { stringValue: 'Item' } },
              { userEnteredValue: { stringValue: 'Category' } },
              { userEnteredValue: { stringValue: 'Price' } },
              { userEnteredValue: { stringValue: 'Type' } },
              { userEnteredValue: { stringValue: 'MonthCycle' } },
              { userEnteredValue: { stringValue: 'Reimbursed' } },
              { userEnteredValue: { stringValue: 'Receipt' } },
            ]
          }]
        }]
      },
      {
        properties: { title: 'Subscriptions' },
        data: [{
          rowData: [{
            values: [
              { userEnteredValue: { stringValue: 'ID' } },
              { userEnteredValue: { stringValue: 'Item' } },
              { userEnteredValue: { stringValue: 'Category' } },
              { userEnteredValue: { stringValue: 'Price' } },
              { userEnteredValue: { stringValue: 'Active' } },
            ]
          }]
        }]
      }
    ]
  };

  const res = await apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res && res.spreadsheetId) {
    setCustomSheetId(res.spreadsheetId, userEmail);
    return res.spreadsheetId;
  }
  throw new Error('Nu s-a putut obține ID-ul noului Google Sheet de la Google.');
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────
let oauthToken = null;
let currentUserEmail = null;

export function setOAuthToken(token) {
  oauthToken = token;
}

export function setUserEmail(email) {
  currentUserEmail = email;
}

function buildUrl(path, params = {}) {
  const activeId = getActiveSheetId(currentUserEmail);
  let base = `https://sheets.googleapis.com/v4/spreadsheets/${activeId}`;

  // If path is full URL (like creating new spreadsheet)
  if (path.startsWith('https://')) {
    const fullUrl = new URL(path);
    if (!oauthToken && API_KEY) fullUrl.searchParams.set('key', API_KEY);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) fullUrl.searchParams.set(k, v);
    });
    return fullUrl.toString();
  }

  let finalPath = path;
  if (path && !path.startsWith('/') && !path.startsWith(':')) {
    finalPath = '/' + path;
  }
  
  const url = new URL(`${base}${finalPath}`);
  
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
    const finalErr = err.name === 'AbortError' ? new Error('Request timed out (15s). Please check your connection.') : err;
    logSystemError(`Google Sheets API (${options.method || 'GET'})`, finalErr);
    throw finalErr;
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
  const url = buildUrl('/values/Expenses!A:I', { valueRenderOption: 'UNFORMATTED_VALUE' });
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
    reimbursed: String(row[7]).toUpperCase() === 'TRUE',
    receipt: row[8] ?? '',
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

function sanitizeReceiptString(str) {
  if (!str) return '';
  if (str.length > 35000) {
    return `[FILE_TOO_LARGE:${str.slice(0, 30)}]`;
  }
  return str;
}

// ──────────────────────────────────────────────────────────────
// APPEND (Expenses)
// ──────────────────────────────────────────────────────────────

/**
 * Append a new expense row.
 * @param {object} expense - { id, timestamp, item, category, price, type, monthCycle, reimbursed, receipt }
 */
export async function appendExpense(expense) {
  const url = buildUrl('/values/Expenses!A:I:append', {
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
      expense.reimbursed ? 'TRUE' : 'FALSE',
      sanitizeReceiptString(expense.receipt),
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
  const range = `Expenses!A${rowIndex}:I${rowIndex}`;
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
      expense.reimbursed ? 'TRUE' : 'FALSE',
      sanitizeReceiptString(expense.receipt),
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
