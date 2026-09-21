/**
 * MoneyTrack — Discord Logger System
 * Expert logging for Expenses, Subscriptions, Reimbursements, and System Errors
 */

const WEBHOOKS = {
  expenses: 'https://discord.com/api/webhooks/1265775087047544923/3BJgUn0hhwHO3wM7iSg3tjomaxk3zDEVWoyrV1_1azgVx67LWlwenNgIV7U7I3rc9XAX',
  subscriptions: 'https://discord.com/api/webhooks/1323680786809098240/Rf9R1N2pAsgd_sqetBTs8CsPrchR0zCncZ6FYYFni2BqMvztRtf6aN170SSK-kzjOSRe',
  decontari: 'https://discord.com/api/webhooks/1323681002383478964/FjTfzBgtyboZ0OGUFCEFhSixpsrRRGIWawaRpIcS3B7NUfRgW_Hroo2CK-rsOVSTIx5M',
  errors: 'https://discord.com/api/webhooks/1323681104007266387/2ept7yMC_wBxJdbxtRd3vuFype2Qs3a7dXxD6vv-tvKThdBpcoGp3m-wb-HhYBQ00Nvh',
};

const BOT_PROFILES = {
  expenses: { username: 'MoneyTrack — Expense Bot', avatar: '💸' },
  subscriptions: { username: 'MoneyTrack — Subscriptions Bot', avatar: '🔄' },
  decontari: { username: 'MoneyTrack — Reimbursement Manager', avatar: '💼' },
  errors: { username: 'MoneyTrack — System Sentinel', avatar: '🚨' },
};

// Colors in Decimal for Discord Embeds
const COLORS = {
  green: 4575600,   // #45D370
  blue: 3848191,    // #3AB5FF
  amber: 16167253,  // #F6AD55
  red: 16521589,    // #FC5555
  purple: 12031220, // #B794F4
  gray: 10529712,   // #A0AEC0
};

async function sendDiscordLog(channelType, embedData) {
  const webhookUrl = WEBHOOKS[channelType];
  if (!webhookUrl) return;

  const botProfile = BOT_PROFILES[channelType] || BOT_PROFILES.expenses;

  const payload = {
    username: botProfile.username,
    embeds: [{
      ...embedData,
      footer: {
        text: 'MoneyTrack Expert Logger • Google Sheets Sync',
      },
      timestamp: new Date().toISOString(),
    }],
  };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn('Discord logger send failed:', err);
  }
}

// ──────────────────────────────────────────────────────────────
// 1. EXPENSE LOGS (#💸-expenses-log)
// ──────────────────────────────────────────────────────────────

export function logExpenseAdded(expense) {
  const fmtPrice = (expense.price || 0).toFixed(2);
  sendDiscordLog('expenses', {
    title: '➕ Cheltuială Nouă Adăugată',
    color: COLORS.green,
    fields: [
      { name: '📦 Obiect / Serviciu', value: expense.item || 'Nespecificat', inline: true },
      { name: '💰 Sumă', value: `**${fmtPrice} RON**`, inline: true },
      { name: '🏷️ Categorie', value: expense.category || 'Other', inline: true },
      { name: '📅 Data', value: new Date(expense.timestamp).toLocaleString('ro-RO'), inline: true },
      { name: '🆔 ID', value: `#${expense.id}`, inline: true },
      { name: '🧾 Bon Atașat', value: expense.receipt ? '✅ Da' : '❌ Nu', inline: true },
    ],
  });
}

export function logExpenseUpdated(oldExpense, newExpense) {
  sendDiscordLog('expenses', {
    title: '✏️ Cheltuială Modificată',
    color: COLORS.amber,
    fields: [
      { name: '🆔 ID', value: `#${newExpense.id}`, inline: true },
      { name: '📦 Denumire Veche ➔ Nouă', value: `${oldExpense.item} ➔ **${newExpense.item}**`, inline: false },
      { name: '💰 Preț Vechi ➔ Nou', value: `${oldExpense.price} RON ➔ **${newExpense.price} RON**`, inline: true },
      { name: '🏷️ Categorie', value: newExpense.category, inline: true },
    ],
  });
}

export function logExpenseDeleted(expense) {
  sendDiscordLog('expenses', {
    title: '🗑️ Cheltuială Ștearsă',
    color: COLORS.red,
    fields: [
      { name: '📦 Obiect', value: expense.item, inline: true },
      { name: '💰 Sumă Ștearsă', value: `${expense.price} RON`, inline: true },
      { name: '🆔 ID', value: `#${expense.id}`, inline: true },
    ],
  });
}

// ──────────────────────────────────────────────────────────────
// 2. SUBSCRIPTION LOGS (#🔄-subscriptions-log)
// ──────────────────────────────────────────────────────────────

export function logSubscriptionAdded(sub) {
  sendDiscordLog('subscriptions', {
    title: '🔄 Abonament Nou Configurat',
    color: COLORS.blue,
    fields: [
      { name: '📺 Abonament', value: sub.item, inline: true },
      { name: '💳 Cost Lunar', value: `**${sub.price} RON**`, inline: true },
      { name: '🏷️ Categorie', value: sub.category, inline: true },
      { name: '⚡ Status', value: sub.active ? '🟢 Activ' : '🔴 Inactiv', inline: true },
    ],
  });
}

export function logSubscriptionToggled(sub) {
  sendDiscordLog('subscriptions', {
    title: sub.active ? '🟢 Abonament Activat' : '⏸️ Abonament Dezactivat',
    color: sub.active ? COLORS.green : COLORS.gray,
    fields: [
      { name: '📺 Abonament', value: sub.item, inline: true },
      { name: '💳 Valoare', value: `${sub.price} RON`, inline: true },
    ],
  });
}

export function logSubscriptionRun(addedSubs, totalAmount) {
  sendDiscordLog('subscriptions', {
    title: '⚡ Rulare Automată Abonamente Ciclul Curent',
    color: COLORS.purple,
    fields: [
      { name: '📋 Număr Abonamente Adăugate', value: `${addedSubs.length} abonamente`, inline: true },
      { name: '💰 Valoare Totală Înregistrată', value: `**${totalAmount.toFixed(2)} RON**`, inline: true },
      { name: '📜 Elemente', value: addedSubs.map(s => `• ${s.item} (${s.price} RON)`).join('\n') || 'Niciunul', inline: false },
    ],
  });
}

export function logSubscriptionDeleted(sub) {
  sendDiscordLog('subscriptions', {
    title: '🗑️ Abonament Eliminat',
    color: COLORS.red,
    fields: [
      { name: '📺 Abonament', value: sub.item, inline: true },
      { name: '💳 Sumă', value: `${sub.price} RON`, inline: true },
    ],
  });
}

// ──────────────────────────────────────────────────────────────
// 3. DECONTARE LOGS (#💼-decontari-log)
// ──────────────────────────────────────────────────────────────

export function logReimbursementToggled(expense) {
  const isReimbursed = expense.reimbursed;
  sendDiscordLog('decontari', {
    title: isReimbursed ? '💼 Bani Decontați cu Succes' : '↩️ Decontare Anulată',
    color: isReimbursed ? COLORS.green : COLORS.amber,
    description: isReimbursed
      ? `Suma de **${expense.price} RON** pentru **"${expense.item}"** a fost decontată și scăzută din totalul cheltuielilor!`
      : `Decontarea pentru **"${expense.item}"** (${expense.price} RON) a fost anulată.`,
    fields: [
      { name: '📦 Produs / Serviciu', value: expense.item, inline: true },
      { name: '💵 Sumă Decontată', value: `**${expense.price} RON**`, inline: true },
      { name: '🆔 ID Cheltuială', value: `#${expense.id}`, inline: true },
      { name: 'STATUS NOU', value: isReimbursed ? '✅ DECONTAT (0 RON cheltuit)' : '💸 CHELTUIALĂ ACTIVĂ', inline: false },
    ],
  });
}

// ──────────────────────────────────────────────────────────────
// 4. SYSTEM & ERROR LOGS (#🚨-system-errors-log)
// ──────────────────────────────────────────────────────────────

export function logSystemError(contextMessage, errorObj) {
  const errorMsg = typeof errorObj === 'string' ? errorObj : errorObj?.message || 'Eroare necunoscută';
  sendDiscordLog('errors', {
    title: '🚨 Eroare Sistem / Google Sheets API',
    color: COLORS.red,
    fields: [
      { name: '📍 Context Acțiune', value: contextMessage || 'Sistem', inline: false },
      { name: '⚠️ Detalii Eroare', value: `\`\`\`${errorMsg.slice(0, 900)}\`\`\``, inline: false },
      { name: '📱 User Agent', value: navigator.userAgent.slice(0, 150), inline: false },
    ],
  });
}
