import React from 'react';
import {
  getCurrentCycle,
  formatCycleRange,
  isCycleCompleted,
} from '../utils/date.js';
import { SALARY } from '../utils/constants.js';

export default function Dashboard({ expenses, subscriptions = [] }) {
  const currentCycle = getCurrentCycle();
  const cycleRange = formatCycleRange(currentCycle);

  // 1. Calculate actual expenses recorded for this cycle
  const expensesInCycle = expenses.filter((e) => e.monthCycle === currentCycle);
  const actualSpentThisCycle = expensesInCycle.reduce((sum, e) => sum + e.price, 0);

  // 2. Calculate active subscriptions that haven't been "run" (recorded as expenses) yet
  // We check if a subscription is already in the expenses for this cycle by comparing the item name and type
  const activeSubscriptions = subscriptions.filter(s => s.active);
  const pendingSubscriptionsTotal = activeSubscriptions.reduce((sum, sub) => {
    const alreadyRecorded = expensesInCycle.some(
      (e) => e.item === sub.item && e.type === 'subscription'
    );
    return alreadyRecorded ? sum : sum + sub.price;
  }, 0);

  // Spent this cycle (Actual + Pending Subs)
  const spentThisCycle = actualSpentThisCycle + pendingSubscriptionsTotal;

  // Saved this cycle
  const savedThisCycle = SALARY - spentThisCycle;

  // Total spent ever (actual records only)
  const totalSpentEver = expenses.reduce((sum, e) => sum + e.price, 0);

  // Total saved ever: count completed cycles only (excluding current)
  const allCycles = [...new Set(expenses.map((e) => e.monthCycle).filter(Boolean))];
  const completedCycles = allCycles.filter(
    (c) => c !== currentCycle && isCycleCompleted(c)
  );
  const completedCount = completedCycles.length;
  const spentInCompleted = expenses
    .filter((e) => completedCycles.includes(e.monthCycle))
    .reduce((sum, e) => sum + e.price, 0);
  const totalSavedEver = completedCount * SALARY - spentInCompleted;

  const fmt = (n) =>
    n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
    </section>
  );
}
