import React, { useState } from 'react';
import {
  getCurrentCycle,
  getPreviousCycle,
  getMonthCycle,
  formatCycleRange,
  isCycleCompleted,
} from '../utils/date.js';
import { SALARY } from '../utils/constants.js';
import {
  getGoogleSheetUrl,
  getActiveSheetId,
  setCustomSheetId,
  resetCustomSheetId,
  createAutoGoogleSheet,
} from '../utils/sheets.js';

export default function Dashboard({ expenses, subscriptions = [], onRefreshData, onLogout }) {
  const currentCycle = getCurrentCycle();
  const prevCycle = getPreviousCycle(currentCycle);
  const cycleRange = formatCycleRange(currentCycle);
  const sheetUrl = getGoogleSheetUrl();
  const activeId = getActiveSheetId();

  // Settings State
  const [customInput, setCustomInput] = useState('');
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetMsg, setSheetMsg] = useState(null);
  const [sheetError, setSheetError] = useState(null);

  async function handleAutoCreateSheet() {
    setSheetError(null);
    setSheetMsg(null);
    setSheetLoading(true);
    try {
      const newId = await createAutoGoogleSheet();
      setSheetMsg(`🎉 Noul tău Google Sheet a fost creat cu succes în Google Drive și conectat!`);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      setSheetError(`Nu s-a putut creea automat Sheet-ul: ${err.message}`);
    } finally {
      setSheetLoading(false);
    }
  }

  function handleSaveCustomSheet(e) {
    e.preventDefault();
    setSheetError(null);
    setSheetMsg(null);
    try {
      const savedId = setCustomSheetId(customInput);
      setSheetMsg(`✅ Google Sheet conectat cu succes! (ID: ${savedId.slice(0, 12)}...)`);
      setCustomInput('');
      if (onRefreshData) onRefreshData();
    } catch (err) {
      setSheetError(err.message);
    }
  }

  function handleResetSheet() {
    if (!window.confirm('Ești sigur că vrei să resetezi la Google Sheet-ul implicit?')) return;
    resetCustomSheetId();
    setSheetMsg('🔄 S-a revenit la Google Sheet-ul implicit.');
    setSheetError(null);
    if (onRefreshData) onRefreshData();
  }

  // Normalize expenses: ensure we always have a cycle based on the timestamp "truth"
  const normalizedExpenses = expenses.map(e => ({
    ...e,
    effectiveCycle: (e.timestamp ? getMonthCycle(e.timestamp) : e.monthCycle) || 'Unknown'
  }));

  // --- CURRENT CYCLE CALCS ---
  const expensesInCycle = normalizedExpenses.filter((e) => e.effectiveCycle === currentCycle);
  const actualSpentThisCycle = expensesInCycle.reduce((sum, e) => sum + (e.reimbursed ? 0 : e.price), 0);

  const activeSubscriptions = subscriptions.filter(s => s.active);
  const pendingSubscriptionsTotal = activeSubscriptions.reduce((sum, sub) => {
    const alreadyRecorded = expensesInCycle.some(
      (e) => e.item === sub.item && e.type === 'subscription'
    );
    return alreadyRecorded ? sum : sum + sub.price;
  }, 0);

  const spentThisCycle = actualSpentThisCycle + pendingSubscriptionsTotal;
  const savedThisCycle = SALARY - spentThisCycle;

  // --- PREVIOUS CYCLE CALCS ---
  const expensesInPrev = normalizedExpenses.filter((e) => e.effectiveCycle === prevCycle);
  const spentPrevCycle = expensesInPrev.reduce((sum, e) => sum + (e.reimbursed ? 0 : e.price), 0);
  const savedPrevCycle = SALARY - spentPrevCycle;

  // --- TOTALS ---
  const totalSpentEver = normalizedExpenses.reduce((sum, e) => sum + (e.reimbursed ? 0 : e.price), 0);
  
  const allCycles = [...new Set(normalizedExpenses.map((e) => e.effectiveCycle).filter(c => c !== 'Unknown'))];
  const completedCycles = allCycles.filter(
    (c) => c !== currentCycle && isCycleCompleted(c)
  );
  const completedCount = completedCycles.length;
  const spentInCompleted = normalizedExpenses
    .filter((e) => completedCycles.includes(e.effectiveCycle))
    .reduce((sum, e) => sum + (e.reimbursed ? 0 : e.price), 0);
  const totalSavedEver = completedCount * SALARY - spentInCompleted;

  const fmt = (n) =>
    n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Percentage change (Spent)
  const spentDiff = spentThisCycle - spentPrevCycle;
  const spentPercentChange = spentPrevCycle > 0 ? (spentDiff / spentPrevCycle) * 100 : 0;

  return (
    <section className="dashboard" aria-label="Financial Dashboard">
      <div className="dashboard-top-bar">
        <div className="dashboard-cycle-label">
          <span className="cycle-icon">📅</span>
          <span>Cycle: <strong>{cycleRange}</strong></span>
        </div>
        <a
          href={sheetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-google-sheet"
          title="Open Google Sheet database in new tab"
        >
          <span className="btn-google-sheet__icon">🟢</span>
          <span>Google Sheet</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </a>
      </div>

      <div className="dashboard-cards">
        <div className="dash-card dash-card--spent">
          <div className="dash-card__label">Spent this cycle</div>
          <div className="dash-card__value">
            {fmt(spentThisCycle)} <span className="currency">RON</span>
          </div>
          {pendingSubscriptionsTotal > 0 && (
            <div className="dash-card__sub">Incl. {fmt(pendingSubscriptionsTotal)} pending subs</div>
          )}
        </div>

        <div className={`dash-card dash-card--saved ${savedThisCycle < 0 ? 'dash-card--negative' : ''}`}>
          <div className="dash-card__label">Saved this cycle</div>
          <div className="dash-card__value">
            {fmt(savedThisCycle)} <span className="currency">RON</span>
          </div>
          <div className="dash-card__sub">Target: {fmt(SALARY)}</div>
        </div>

        <div className="dash-card dash-card--total-spent">
          <div className="dash-card__label">Total spent ever</div>
          <div className="dash-card__value">{fmt(totalSpentEver)} <span className="currency">RON</span></div>
        </div>

        <div className={`dash-card dash-card--total-saved ${totalSavedEver < 0 ? 'dash-card--negative' : ''}`}>
          <div className="dash-card__label">Total saved ever</div>
          <div className="dash-card__value">{fmt(totalSavedEver)} <span className="currency">RON</span></div>
          <div className="dash-card__sub">{completedCount} completed cycle{completedCount !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* Progress Comparison */}
      <div className="dashboard-progress card">
        <h3 className="dashboard-progress__title">Monthly Comparison</h3>
        <div className="comparison-table-wrapper">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Last Month</th>
                <th>This Month</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Spent</td>
                <td>{fmt(spentPrevCycle)}</td>
                <td>{fmt(spentThisCycle)}</td>
                <td className={spentDiff > 0 ? 'text-danger' : 'text-success'}>
                  {spentDiff > 0 ? '↑' : '↓'} {fmt(Math.abs(spentDiff))} ({fmt(spentPercentChange)}%)
                </td>
              </tr>
              <tr>
                <td>Saved</td>
                <td>{fmt(savedPrevCycle)}</td>
                <td>{fmt(savedThisCycle)}</td>
                <td className={savedThisCycle > savedPrevCycle ? 'text-success' : 'text-danger'}>
                  {savedThisCycle > savedPrevCycle ? '↑' : '↓'} {fmt(Math.abs(savedThisCycle - savedPrevCycle))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Visual Progress Bar */}
        <div className="budget-progress">
          <div className="budget-progress__labels">
            <span>Budget Usage</span>
            <span>{fmt((spentThisCycle / SALARY) * 100)}%</span>
          </div>
          <div className="progress-bar">
            <div 
              className={`progress-bar__fill ${spentThisCycle > SALARY ? 'progress-bar__fill--danger' : ''}`}
              style={{ width: `${Math.min(100, (spentThisCycle / SALARY) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* ⚙️ SETTINGS / DATABASE SETUP SECTION */}
      <div className="card dashboard-settings-card">
        <div className="dashboard-settings-header">
          <h3 className="dashboard-settings__title">
            <span>⚙️ Setări Bază de Date (Google Sheet)</span>
          </h3>
          <span className="sheet-connected-badge">🟢 Conectat</span>
        </div>

        <p className="dashboard-settings__desc">
          Fiecare utilizator poate avea propriul Google Sheet creat și securizat în contul său personal de Google Drive.
        </p>

        {sheetMsg && <div className="alert alert--success mb-3" role="status">{sheetMsg}</div>}
        {sheetError && <div className="alert alert--error mb-3" role="alert">{sheetError}</div>}

        {/* 1-Click Auto Creation */}
        <div className="settings-auto-create-box">
          <div className="auto-create-info">
            <h4>🪄 Cont Nou? Creează-ți propriul Google Sheet cu 1 Singur Click</h4>
            <p>Aplicația va genera automat un fișier complet formatat în Google Drive-ul tău cu tabelele Expenses & Subscriptions.</p>
          </div>
          <button
            type="button"
            className="btn btn--primary btn-auto-create-sheet"
            disabled={sheetLoading}
            onClick={handleAutoCreateSheet}
          >
            {sheetLoading ? (
              <>
                <span className="spinner spinner--sm" />
                <span>Se creează în Google Drive...</span>
              </>
            ) : (
              <>
                <span>🪄 Creează Automat Google Sheet-ul Meu</span>
              </>
            )}
          </button>
        </div>

        <div className="settings-divider">
          <span>sau conectează un Google Sheet existent</span>
        </div>

        {/* Custom Sheet Link/ID Input */}
        <form onSubmit={handleSaveCustomSheet} className="settings-custom-form">
          <div className="form-group flex-1">
            <label htmlFor="custom-sheet-input">Link sau ID Google Sheet Existent</label>
            <input
              id="custom-sheet-input"
              type="text"
              className="settings-input"
              placeholder="Lipește link-ul (ex: https://docs.google.com/spreadsheets/d/...) sau ID-ul"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              disabled={sheetLoading}
            />
          </div>
          <button type="submit" className="btn btn--ghost btn-connect-sheet" disabled={sheetLoading || !customInput.trim()}>
            💾 Conectează Sheet
          </button>
        </form>

        <div className="settings-footer-info">
          <span className="active-id-label">ID Activ: <code>{activeId || 'Implicit'}</code></span>
          <div className="settings-footer-actions">
            <button type="button" className="btn-reset-sheet" onClick={handleResetSheet}>
              🔄 Resetează Sheet
            </button>
            {onLogout && (
              <button type="button" className="btn-logout-settings" onClick={onLogout}>
                🚪 Deconectare Cont Google
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
