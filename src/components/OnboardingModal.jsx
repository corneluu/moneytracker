import React, { useState } from 'react';
import { setSalary as saveSalary, setPayDay as savePayDay } from '../utils/constants.js';
import { createAutoGoogleSheet, setCustomSheetId } from '../utils/sheets.js';

export default function OnboardingModal({ userEmail, userName, onComplete, onReAuth }) {
  const [step, setStep] = useState(1);
  const [salaryInput, setSalaryInput] = useState('5000');
  const [payDayInput, setPayDayInput] = useState('7');
  const [customSheetInput, setCustomSheetInput] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const isScopeError = error && error.toLowerCase().includes('scope');

  function handleStep1Submit(e) {
    e.preventDefault();
    setError(null);
    try {
      saveSalary(salaryInput, userEmail);
      savePayDay(payDayInput, userEmail);
      setStep(2);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAutoCreate() {
    setError(null);
    setLoading(true);
    try {
      await createAutoGoogleSheet(userEmail);
      onComplete();
    } catch (err) {
      setError(`Eroare la crearea fișierului în Google Drive: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  function handleCustomConnect(e) {
    e.preventDefault();
    setError(null);
    try {
      setCustomSheetId(customSheetInput, userEmail);
      onComplete();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleReAuthClick() {
    sessionStorage.removeItem('moneytrack_token');
    if (onReAuth) onReAuth();
  }

  return (
    <div className="onboarding-overlay" role="dialog" aria-modal="true">
      <div className="onboarding-card">
        <div className="onboarding-header">
          <div className="onboarding-logo">💰 MoneyTrack</div>
          <span className="onboarding-step-badge">Pasul {step} din 2</span>
        </div>

        <h2 className="onboarding-title">
          {step === 1 ? `Bine ai venit, ${userName || 'utilizator nou'}! 👋` : '🪄 Creează Baza Ta De Date'}
        </h2>
        <p className="onboarding-desc">
          {step === 1
            ? 'Pentru a începe, setează salariul tău lunar și ziua în care îl primești. Aceste date vor fi private și salvate doar pentru contul tău.'
            : 'Fiecare utilizator MoneyTrack are propriul Google Sheet securizat în Google Drive-ul personal. Fă 1 click mai jos pentru a genera automat fișierul tău!'}
        </p>

        {error && (
          <div className="alert alert--error mb-3" role="alert">
            <div>⚠️ {error}</div>
            {isScopeError && (
              <button
                type="button"
                className="btn btn--primary btn--sm mt-2"
                onClick={handleReAuthClick}
              >
                🔑 Re-conectează-te cu Google (Acordă permisiuni)
              </button>
            )}
          </div>
        )}

        {step === 1 && (
          <form onSubmit={handleStep1Submit} className="onboarding-form">
            <div className="form-group">
              <label htmlFor="onboarding-salary">Salariu Lunar (RON)</label>
              <input
                id="onboarding-salary"
                type="number"
                className="settings-input"
                min="0"
                step="100"
                value={salaryInput}
                onChange={(e) => setSalaryInput(e.target.value)}
                placeholder="ex: 5000"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="onboarding-payday">Ziua Salariului din Lună (1-31)</label>
              <input
                id="onboarding-payday"
                type="number"
                className="settings-input"
                min="1"
                max="31"
                value={payDayInput}
                onChange={(e) => setPayDayInput(e.target.value)}
                placeholder="ex: 7"
                required
              />
            </div>

            <button type="submit" className="btn btn--primary btn--lg btn--full mt-4">
              Pasul Următor ➔
            </button>
          </form>
        )}

        {step === 2 && (
          <div className="onboarding-step2-content">
            <div className="onboarding-auto-box">
              <div className="auto-create-info">
                <h4>✨ Opțiunea Recomandată (1-Click Auto Creation)</h4>
                <p>Aplicația va crea automat un tabel nou intitulat "MoneyTrack — Baza Mea De Date" în contul tău de Google Drive.</p>
              </div>
              <button
                type="button"
                className="btn btn--primary btn--lg btn--full btn-auto-create-sheet"
                disabled={loading}
                onClick={handleAutoCreate}
              >
                {loading ? (
                  <>
                    <span className="spinner spinner--sm" />
                    <span>Se generează fișierul în Google Drive...</span>
                  </>
                ) : (
                  <span>🪄 Creează Automat Google Sheet-ul Meu</span>
                )}
              </button>
            </div>

            <div className="settings-divider my-4">
              <span>sau conectează un Sheet deja existent</span>
            </div>

            <form onSubmit={handleCustomConnect} className="onboarding-custom-form">
              <div className="form-group">
                <label htmlFor="onboarding-custom-sheet">Link sau ID Google Sheet Existent</label>
                <input
                  id="onboarding-custom-sheet"
                  type="text"
                  className="settings-input"
                  placeholder="Lipește link-ul https://docs.google.com/spreadsheets/d/..."
                  value={customSheetInput}
                  onChange={(e) => setCustomSheetInput(e.target.value)}
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                className="btn btn--ghost btn--full"
                disabled={loading || !customSheetInput.trim()}
              >
                🔗 Conectează Sheet Existent
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
