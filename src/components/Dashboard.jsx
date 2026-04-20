import React from 'react';
import {
  getCurrentCycle,
  formatCycleRange,
  isCycleCompleted,
} from '../utils/date.js';

const SALARY = 5000;

export default function Dashboard({ expenses }) {
  const currentCycle = getCurrentCycle();
  const cycleRange = formatCycleRange(currentCycle);

  // Spent this cycle
  const spentThisCycle = expenses
    .filter((e) => e.monthCycle === currentCycle)
    .reduce((sum, e) => sum + e.price, 0);

  // Total spent ever
  const totalSpentEver = expenses.reduce((sum, e) => sum + e.price, 0);

  // Saved this cycle
  const savedThisCycle = SALARY - spentThisCycle;

  // Total saved ever: count completed cycles only (excluding current)
  const allCycles = [...new Set(expenses.map((e) => e.monthCycle))];
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
          <div className="dash-card__value">{fmt(spentThisCycle)} <span className="currency">RON</span></div>
        </div>

        <div className={`dash-card dash-card--saved ${savedThisCycle < 0 ? 'dash-card--negative' : ''}`}>
          <div className="dash-card__label">Saved this cycle</div>
          <div className="dash-card__value">
            {fmt(savedThisCycle)} <span className="currency">RON</span>
          </div>
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
