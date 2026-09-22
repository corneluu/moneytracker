import React, { useEffect, useState, useCallback, useRef } from 'react';
import Dashboard from './components/Dashboard.jsx';
import ExpenseForm from './components/ExpenseForm.jsx';
import Subscriptions from './components/Subscriptions.jsx';
import History from './components/History.jsx';
import OnboardingModal from './components/OnboardingModal.jsx';
import { fetchExpenses, fetchSubscriptions, setOAuthToken, setUserEmail, isUserSheetConfigured } from './utils/sheets.js';
import { isUserSalaryConfigured } from './utils/constants.js';
import './App.css';

const TABS = ['Dashboard', 'Add Expense', 'Subscriptions', 'History'];
const TAB_ICONS = ['📊', '➕', '🔄', '📜'];
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function UserAvatar({ picture, name }) {
  const [failed, setFailed] = useState(false);
  const initial = (name || 'U').trim()[0]?.toUpperCase() || '👤';

  if (picture && !failed) {
    return (
      <img
        src={picture}
        alt={name || 'User Avatar'}
        className="user-badge__avatar"
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
        onError={() => setFailed(true)}
      />
    );
  }

  return <span className="user-badge__initial">{initial}</span>;
}

export default function App() {
  const [expenses, setExpenses] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);

  // Auth & Profile State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const tokenClient = useRef(null);

  const fetchUserProfile = useCallback(async (token) => {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const profile = await res.json();
        setUserProfile(profile);
        setUserEmail(profile.email);
        sessionStorage.setItem('moneytrack_user_profile', JSON.stringify(profile));

        // Check if onboarding is needed for this user
        const isSheetSet = isUserSheetConfigured(profile.email);
        const isSalarySet = isUserSalaryConfigured(profile.email);
        if (!isSheetSet || !isSalarySet) {
          setShowOnboarding(true);
        }
      }
    } catch (e) {
      console.warn('Could not fetch user profile:', e);
    }
  }, []);

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
        scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
        callback: async (tokenResponse) => {
          if (tokenResponse && tokenResponse.access_token) {
            setOAuthToken(tokenResponse.access_token);
            sessionStorage.setItem('moneytrack_token', tokenResponse.access_token);
            setIsAuthenticated(true);
            setError(null);
            await fetchUserProfile(tokenResponse.access_token);
          } else {
            setError('Failed to authenticate with Google.');
          }
        },
      });
    }
  }

  useEffect(() => {
    // Check for cached token & user profile
    const storedToken = sessionStorage.getItem('moneytrack_token');
    const storedProfile = sessionStorage.getItem('moneytrack_user_profile');
    if (storedProfile) {
      try {
        const prof = JSON.parse(storedProfile);
        setUserProfile(prof);
        setUserEmail(prof.email);
      } catch (e) {}
    }
    if (storedToken) {
      setOAuthToken(storedToken);
      setIsAuthenticated(true);
      fetchUserProfile(storedToken);
    }
    initGoogleAuth();
  }, [fetchUserProfile]);

  useEffect(() => {
    if (isAuthenticated && !showOnboarding) {
      loadData();
    }
  }, [isAuthenticated, showOnboarding, loadData]);

  function handleLogin() {
    initGoogleAuth(); // Try again in case script loaded late
    if (tokenClient.current) {
      tokenClient.current.requestAccessToken({ prompt: 'select_account' });
    } else {
      setError('Google Accounts script not loaded yet. Please wait a second and try again.');
    }
  }

  function handleLogout() {
    const currentToken = sessionStorage.getItem('moneytrack_token');
    if (currentToken && window.google?.accounts?.oauth2?.revoke) {
      try {
        window.google.accounts.oauth2.revoke(currentToken, () => {});
      } catch (e) {
        console.warn('Revoke token warning:', e);
      }
    }

    setIsAuthenticated(false);
    setUserProfile(null);
    setShowOnboarding(false);
    setOAuthToken(null);
    setUserEmail(null);
    sessionStorage.removeItem('moneytrack_token');
    sessionStorage.removeItem('moneytrack_user_profile');
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

          <div className="header-actions">
            <button
              type="button"
              className="btn-header-icon refresh-btn"
              onClick={loadData}
              disabled={loading}
              title="Reîmprospătează datele"
              id="refresh-data-btn"
              aria-label="Refresh data"
            >
              {loading ? (
                <span className="spinner spinner--sm" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                </svg>
              )}
            </button>

            {userProfile ? (
              <div className="user-profile-pill" title={`Conectat: ${userProfile.email}`}>
                <UserAvatar
                  picture={userProfile.picture}
                  name={userProfile.given_name || userProfile.name || userProfile.email}
                />
                <span className="user-profile-pill__name">{userProfile.given_name || userProfile.name?.split(' ')[0] || 'User'}</span>
                <button
                  type="button"
                  className="btn-logout-inline"
                  onClick={handleLogout}
                  title="Deconectare cont Google"
                  id="logout-btn"
                  aria-label="Deconectare cont Google"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn--logout btn--sm"
                onClick={handleLogout}
                title="Deconectare cont Google"
                id="logout-btn"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                <span>Ieșire</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Onboarding Overlay for New Users */}
      {showOnboarding && (
        <OnboardingModal
          userEmail={userProfile?.email}
          userName={userProfile?.given_name || userProfile?.name}
          onReAuth={handleLogin}
          onComplete={() => {
            setShowOnboarding(false);
            loadData();
          }}
        />
      )}

      {/* Error banner */}
      {error && (() => {
        const isAuthErr = error.includes('AUTH_EXPIRED') || error.toLowerCase().includes('credential') || error.toLowerCase().includes('authentication') || error.includes('401');
        const cleanMsg = error.replace(/^AUTH_EXPIRED:\s*/, '');
        return (
          <div className="global-error" role="alert">
            <span>⚠️ {cleanMsg}</span>
            {isAuthErr ? (
              <button className="btn btn--primary btn--sm ml-2" onClick={handleLogin}>
                🔑 Reconectare Google
              </button>
            ) : (
              <button className="btn btn--ghost btn--sm ml-2" onClick={loadData}>
                ⟳ Reîncearcă
              </button>
            )}
          </div>
        );
      })()}

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
            if (activeTab === 0) return (
              <Dashboard
                expenses={expenses || []}
                subscriptions={subscriptions || []}
                onRefreshData={loadData}
                onLogout={handleLogout}
                userEmail={userProfile?.email}
              />
            );
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
