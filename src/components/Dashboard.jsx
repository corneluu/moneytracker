import React from 'react';
import {
  getCurrentCycle,
  getPreviousCycle,
  formatCycleRange,
  isCycleCompleted,
} from '../utils/date.js';
import { SALARY } from '../utils/constants.js';

export default function Dashboard({ expenses, subscriptions = [] }) {
  const currentCycle = getCurrentCycle();
  const prevCycle = getPreviousCycle(currentCycle);
  const cycleRange = formatCycleRange(currentCycle);

  // Normalize expenses: ensure we always have a cycle based on the timestamp "truth"
  const normalizedExpenses = expenses.map(e => ({
    ...e,
    effectiveCycle: (e.timestamp ? getMonthCycle(e.timestamp) : e.monthCycle) || 'Unknown'
  }));

  // --- CURRENT CYCLE CALCS ---
  const expensesInCycle = normalizedExpenses.filter((e) => e.effectiveCycle === currentCycle);
  const actualSpentThisCycle = expensesInCycle.reduce((sum, e) => sum + e.price, 0);

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
  const spentPrevCycle = expensesInPrev.reduce((sum, e) => sum + e.price, 0);
  const savedPrevCycle = SALARY - spentPrevCycle;

  // --- TOTALS ---
  const totalSpentEver = normalizedExpenses.reduce((sum, e) => sum + e.price, 0);
  
  const allCycles = [...new Set(normalizedExpenses.map((e) => e.effectiveCycle).filter(c => c !== 'Unknown'))];
  const completedCycles = allCycles.filter(
    (c) => c !== currentCycle && isCycleCompleted(c)
  );
  const completedCount = completedCycles.length;
  const spentInCompleted = normalizedExpenses
    .filter((e) => completedCycles.includes(e.effectiveCycle))
    .reduce((sum, e) => sum + e.price, 0);
  const totalSavedEver = completedCount * SALARY - spentInCompleted;

  const fmt = (n) =>
    n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Percentage change (Spent)
  const spentDiff = spentThisCycle - spentPrevCycle;
  const spentPercentChange = spentPrevCycle > 0 ? (spentDiff / spentPrevCycle) * 100 : 0;

  return (
    <section className="dashboard" aria-label="Financial Dashboard">
      <div className="dashboard-cycle-label">
        <span className="cycle-icon">📅</span>
        <span>Cycle: <strong>{cycleRange}</strong></span>
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
    </section>
  );
}
