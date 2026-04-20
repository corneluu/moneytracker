import React, { useEffect, useState, useCallback } from 'react';
import Dashboard from './components/Dashboard.jsx';
import ExpenseForm from './components/ExpenseForm.jsx';
import Subscriptions from './components/Subscriptions.jsx';
import History from './components/History.jsx';
import { fetchExpenses, fetchSubscriptions } from './utils/sheets.js';
import './App.css';

const TABS = ['Dashboard', 'Add Expense', 'Subscriptions', 'History'];
const TAB_ICONS = ['📊', '➕', '🔄', '📜'];

export default function App() {
  const [expenses, setExpenses] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [exp, subs] = await Promise.all([fetchExpenses(), fetchSubscriptions()]);
      setExpenses(exp);
      setSubscriptions(subs);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Expense mutations (optimistic local state) ──────────────────
  function handleExpenseAdded(expense) {
    setExpenses((prev) => [...prev, expense]);
  }

  function handleExpenseUpdated(updated) {
    setExpenses((prev) =>
      prev.map((e) => (e.id === updated.id ? updated : e))
    );
  }

  function handleExpenseDeleted(id) {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  // ── Subscription mutations ──────────────────────────────────────
  function handleSubsChanged(action) {
    setSubscriptions((prev) => {
      if (action.type === 'add') return [...prev, action.sub];
      if (action.type === 'update')
        return prev.map((s) => (s.id === action.sub.id ? action.sub : s));
      if (action.type === 'delete')
        return prev.filter((s) => s.id !== action.id);
      return prev;
    });
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="app-header__inner">
          <div className="app-logo">
            <span className="app-logo__icon">💰</span>
            <span className="app-logo__text">MoneyTrack</span>
          </div>
          <button
            className="btn btn--ghost btn--sm refresh-btn"
            onClick={loadData}
            disabled={loading}
            title="Refresh data"
            id="refresh-data-btn"
          >
            {loading ? <span className="spinner spinner--sm" /> : '⟳ Refresh'}
          </button>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="global-error" role="alert">
          ⚠️ {error}
          <button className="btn btn--ghost btn--sm ml-2" onClick={loadData}>Retry</button>
        </div>
      )}

      {/* Loading overlay on initial load */}
      {loading && expenses.length === 0 && (
        <div className="loading-screen" aria-live="polite">
          <div className="loading-screen__spinner" />
          <p>Loading your financial data…</p>
        </div>
      )}

      {!loading || expenses.length > 0 ? (
        <>
          {/* Dashboard always visible */}
          <Dashboard expenses={expenses} />

          {/* Tab nav */}
          <nav className="tab-nav" aria-label="Main navigation">
            {TABS.map((tab, i) => (
              <button
                key={tab}
                className={`tab-nav__btn ${activeTab === i ? 'tab-nav__btn--active' : ''}`}
                onClick={() => setActiveTab(i)}
                id={`tab-${tab.toLowerCase().replace(' ', '-')}`}
              >
                <span className="tab-nav__icon">{TAB_ICONS[i]}</span>
                <span className="tab-nav__label">{tab}</span>
              </button>
            ))}
          </nav>

          {/* Tab panels */}
          <main className="app-main">
            {activeTab === 0 && (
              <section aria-label="Dashboard detail">
                <div className="welcome-banner">
                  <h1>Your Financial Overview</h1>
                  <p>Track expenses, manage subscriptions, and stay on budget — all in one place.</p>
                </div>
              </section>
            )}

            {activeTab === 1 && (
              <ExpenseForm onExpenseAdded={handleExpenseAdded} />
            )}

            {activeTab === 2 && (
              <Subscriptions
                subscriptions={subscriptions}
                expenses={expenses}
                onSubsChanged={handleSubsChanged}
                onExpenseAdded={handleExpenseAdded}
              />
            )}

            {activeTab === 3 && (
              <History
                expenses={expenses}
                onExpenseUpdated={handleExpenseUpdated}
                onExpenseDeleted={handleExpenseDeleted}
              />
            )}
          </main>
        </>
      ) : null}

      <footer className="app-footer">
        <span>MoneyTrack · Salary cycle tracker · RON</span>
      </footer>
    </div>
  );
}
