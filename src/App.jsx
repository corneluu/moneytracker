import React, { useEffect, useState, useCallback, useRef } from 'react';
import Dashboard from './components/Dashboard.jsx';
import ExpenseForm from './components/ExpenseForm.jsx';
import Subscriptions from './components/Subscriptions.jsx';
import History from './components/History.jsx';
import { fetchExpenses, fetchSubscriptions, setOAuthToken } from './utils/sheets.js';
import './App.css';

const TABS = ['Dashboard', 'Add Expense', 'Subscriptions', 'History'];
const TAB_ICONS = ['📊', '➕', '🔄', '📜'];
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function App() {
  const [expenses, setExpenses] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);

  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const tokenClient = useRef(null);

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
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
  }, [isAuthenticated]);

  // Init Google Identity Services
  function initGoogleAuth() {
    if (window.google && !tokenClient.current) {
      tokenClient.current = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        callback: (tokenResponse) => {
          if (tokenResponse && tokenResponse.access_token) {
            setOAuthToken(tokenResponse.access_token);
            sessionStorage.setItem('moneytrack_token', tokenResponse.access_token);
            setIsAuthenticated(true);
            setError(null);
          } else {
            setError('Failed to authenticate with Google.');
          }
        },
      });
    }
  }

  useEffect(() => {
    // Check for cached token (optional, but good for local dev refreshes)
    const storedToken = sessionStorage.getItem('moneytrack_token');
    if (storedToken) {
      setOAuthToken(storedToken);
      setIsAuthenticated(true);
    }
    initGoogleAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, loadData]);

  function handleLogin() {
    initGoogleAuth(); // Try again in case script loaded late
    if (tokenClient.current) {
      tokenClient.current.requestAccessToken();
    } else {
      setError('Google Accounts script not loaded yet. Please wait a second and try again.');
    }
  }

  function handleLogout() {
    setIsAuthenticated(false);
    setOAuthToken(null);
    sessionStorage.removeItem('moneytrack_token');
    setExpenses([]);
    setSubscriptions([]);
  }

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
    // Re-fetch to sync row indices after a deletion (with a small delay for API stability)
    setTimeout(() => loadData(), 500);
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
    
    // If a subscription was deleted or added, re-fetch to sync row indices
    if (action.type === 'delete' || action.type === 'add') {
      setTimeout(() => loadData(), 500);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="app app--login">
        <div className="login-container">
          <div className="login-card">
            <div className="app-logo app-logo--large">
              <span className="app-logo__icon">💰</span>
              <span className="app-logo__text">MoneyTrack</span>
            </div>
            <h1 className="login-title">Welcome Back</h1>
            <p className="login-subtitle">
              Securely track your expenses and salary cycles using Google Sheets as your private database.
            </p>
            
            {error && (
              <div className="alert alert--error mb-4" role="alert">
                <span className="alert__icon">⚠️</span> {error}
              </div>
            )}

            <button className="btn btn--primary btn--lg btn--full login-btn" onClick={handleLogin}>
              <span className="btn__icon">🔑</span> Sign in with Google
            </button>
            
            <p className="login-footer">
              Your data never leaves Google's servers. We only ask for permission to write to your selected spreadsheet.
            </p>
          </div>
        </div>
      </div>
    );
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

      {/* Initial Loading overlay */}
      {loading && expenses.length === 0 && (
        <div className="loading-overlay" aria-live="polite">
          <div className="loading-screen">
            <div className="loading-screen__spinner" />
            <p>Syncing with your Google Sheet…</p>
          </div>
        </div>
      )}

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

      {/* Main Content */}
      <main className="app-main">
        {(() => {
          try {
            if (activeTab === 0) return <Dashboard expenses={expenses || []} subscriptions={subscriptions || []} />;
            if (activeTab === 1) return <ExpenseForm onExpenseAdded={handleExpenseAdded} expenses={expenses || []} />;
            if (activeTab === 2) return (
              <Subscriptions
                subscriptions={subscriptions || []}
                expenses={expenses || []}
                onSubsChanged={handleSubsChanged}
                onExpenseAdded={handleExpenseAdded}
              />
            );
            if (activeTab === 3) return (
              <History
                expenses={expenses || []}
                onExpenseUpdated={handleExpenseUpdated}
                onExpenseDeleted={handleExpenseDeleted}
              />
            );
            return null;
          } catch (err) {
            return (
              <div className="alert alert--error">
                <h3>UI Crash Detected</h3>
                <p>{err.message}</p>
                <button className="btn btn--primary mt-2" onClick={() => window.location.reload()}>Reload App</button>
              </div>
            );
          }
        })()}
      </main>

      <footer className="app-footer">
        <span>MoneyTrack · Salary cycle tracker · RON</span>
      </footer>
    </div>
  );
}
