import React, { useState, useRef } from 'react';
import { getMonthCycle, localDatetimeDefault } from '../utils/date.js';
import { appendExpense } from '../utils/sheets.js';
import { compressReceiptFile, parseReceiptOCR } from '../utils/receiptParser.js';

const CATEGORIES = [
  { id: 'Food',          label: 'Food & Drink',   icon: '🍔', hex: '#F6AD55', glow: 'rgba(246,173,85,0.45)'  },
  { id: 'Transport',     label: 'Transport',       icon: '🚗', hex: '#63B3ED', glow: 'rgba(99,179,237,0.45)'  },
  { id: 'Shopping',      label: 'Shopping',        icon: '🛍️', hex: '#FC8181', glow: 'rgba(252,129,129,0.45)' },
  { id: 'Entertainment', label: 'Fun',             icon: '🎮', hex: '#B794F4', glow: 'rgba(183,148,244,0.45)' },
  { id: 'Health',        label: 'Health',          icon: '💊', hex: '#68D391', glow: 'rgba(104,211,145,0.45)' },
  { id: 'Bills',         label: 'Bills',           icon: '🧾', hex: '#76E4F7', glow: 'rgba(118,228,247,0.45)' },
  { id: 'Other',         label: 'Other',           icon: '📦', hex: '#A0AEC0', glow: 'rgba(160,174,192,0.35)' },
];

function buildLocalDatetime(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ExpenseForm({ onExpenseAdded, expenses }) {
  const [item,     setItem]     = useState('');
  const [datetime, setDatetime] = useState(localDatetimeDefault());
  const [category, setCategory] = useState('Food');
  const [price,    setPrice]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [success,  setSuccess]  = useState(false);
  const [quickDate,setQuickDate]= useState(0);
  const [showDP,   setShowDP]   = useState(false);

  // Receipt & OCR states
  const [receipt, setReceipt]   = useState(null);
  const [scanning, setScanning] = useState(false);
  const [ocrNotice, setOcrNotice] = useState(null);

  // For animated price display
  const [priceFocused, setPriceFocused] = useState(false);
  const priceRef = useRef(null);

  // Input refs for file upload modes
  const cameraInputRef  = useRef(null);
  const galleryInputRef = useRef(null);
  const digitalInputRef = useRef(null);

  const cat = CATEGORIES.find(c => c.id === category) || CATEGORIES[0];

  function handleQuickDate(idx) {
    setQuickDate(idx);
    setShowDP(false);
    setDatetime(buildLocalDatetime(idx === 0 ? 0 : -1));
  }

  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setOcrNotice(null);
    setScanning(true);

    try {
      const processed = await compressReceiptFile(file);
      setReceipt(processed);

      // Run OCR for images
      if (processed.type === 'image') {
        const ocr = await parseReceiptOCR(processed.dataUrl);
        if (ocr.detectedPrice && (!price || parseFloat(price) === 0)) {
          setPrice(String(ocr.detectedPrice));
          setOcrNotice(`✨ Sumă extrasă automat: ${ocr.detectedPrice.toFixed(2)} RON`);
        } else if (ocr.detectedPrice) {
          setOcrNotice(`✨ Sumă detectată pe bon: ${ocr.detectedPrice.toFixed(2)} RON`);
        }

        if (ocr.detectedItem && !item.trim()) {
          setItem(ocr.detectedItem);
        }
      } else {
        setOcrNotice(`📄 Bon digital atașat (${file.name})`);
      }
    } catch (err) {
      setError(`Nu s-a putut procesa bonul: ${err.message}`);
    } finally {
      setScanning(false);
      // Reset input value so same file can be re-selected if needed
      e.target.value = '';
    }
  }

  function removeReceipt() {
    setReceipt(null);
    setOcrNotice(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const priceNum = parseFloat(price);
    if (!item.trim())                     return setError('Enter an item name.');
    if (isNaN(priceNum) || priceNum <= 0) return setError('Enter a valid positive amount.');
    if (!datetime)                        return setError('Date & time is required.');

    const isoTimestamp = new Date(datetime).toISOString();
    const monthCycle   = getMonthCycle(isoTimestamp);
    const maxId = expenses.reduce((max, e) => {
      const n = parseInt(e.id, 10);
      return !isNaN(n) && n > max ? n : max;
    }, 0);
    const newId = String(maxId + 1);

    // Save full receipt in browser storage for instant lightbox viewing
    if (receipt?.dataUrl) {
      try {
        localStorage.setItem(`moneytrack_receipt_${newId}`, JSON.stringify({
          name: receipt.name,
          type: receipt.type,
          dataUrl: receipt.dataUrl,
        }));
      } catch (e) {
        console.warn('LocalStorage limit for receipt cache reached:', e);
      }
    }

    const expense = {
      id: newId,
      timestamp: isoTimestamp,
      item: item.trim(),
      category,
      price: priceNum,
      type: 'expense',
      monthCycle,
      reimbursed: false,
      receipt: receipt?.sheetPayload || receipt?.dataUrl || '',
    };

    setLoading(true);
    try {
      await appendExpense(expense);
      setSuccess(true);
      setItem(''); setPrice('');
      setDatetime(localDatetimeDefault());
      setCategory('Food'); setQuickDate(0); setShowDP(false);
      setReceipt(null); setOcrNotice(null);
      onExpenseAdded(expense);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ef2-wrap" aria-label="Add Expense">

      {/* Hidden file inputs for Camera, Gallery, Digital */}
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
      <input
        type="file"
        ref={galleryInputRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
      <input
        type="file"
        ref={digitalInputRef}
        accept="image/*,.pdf,application/pdf"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* ── Ambient glow ── */}
      <div className="ef2-ambient" style={{ '--cat-glow': cat.glow, '--cat-hex': cat.hex }} aria-hidden="true" />

      {/* ── Success State ── */}
      {success && (
        <div className="ef2-success" role="status" aria-live="polite">
          <div className="ef2-success__ring">
            <span className="ef2-success__check">✓</span>
          </div>
          <div className="ef2-success__body">
            <div className="ef2-success__title">Expense saved</div>
            <div className="ef2-success__sub">Synced to your Google Sheet</div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>

        {/* ══ STEP 1 — Category ══════════════════════════════════════ */}
        <div className="ef2-section">
          <p className="ef2-section-label">Category</p>
          <div className="ef2-cat-grid" role="radiogroup">
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={category === c.id}
                disabled={loading}
                className={`ef2-cat-pill ${category === c.id ? 'ef2-cat-pill--on' : ''}`}
                style={{
                  '--ch': c.hex,
                  '--cg': c.glow,
                }}
                onClick={() => setCategory(c.id)}
              >
                <span className="ef2-cat-pill__bg" aria-hidden="true" />
                <span className="ef2-cat-pill__icon">{c.icon}</span>
                <span className="ef2-cat-pill__name">{c.label}</span>
                {category === c.id && <span className="ef2-cat-pill__dot" aria-hidden="true" />}
              </button>
            ))}
          </div>
        </div>

        {/* ══ STEP 2 — Amount ══════════════════════════════════════ */}
        <div className="ef2-section">
          <p className="ef2-section-label">Amount</p>
          <div
            className={`ef2-price-card ${priceFocused ? 'ef2-price-card--focus' : ''}`}
            style={{ '--ch': cat.hex, '--cg': cat.glow }}
            onClick={() => priceRef.current?.focus()}
          >
            <div className="ef2-price-card__glow" aria-hidden="true" />
            <div className="ef2-price-card__inner">
              <span className="ef2-price-currency">RON</span>
              <input
                ref={priceRef}
                id="ef-price"
                type="number"
                className="ef2-price-input"
                placeholder="0.00"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={price}
                onChange={e => setPrice(e.target.value)}
                onFocus={() => setPriceFocused(true)}
                onBlur={() => setPriceFocused(false)}
                disabled={loading}
                required
                aria-label="Amount in RON"
              />
            </div>
            <div className="ef2-price-card__hint">Tap to enter amount</div>
          </div>
        </div>

        {/* ══ STEP 3 — Item ════════════════════════════════════════ */}
        <div className="ef2-section">
          <label htmlFor="ef-item" className="ef2-section-label">What was it?</label>
          <div className="ef2-input-wrap">
            <span className="ef2-input-icon" aria-hidden="true">{cat.icon}</span>
            <input
              id="ef-item"
              type="text"
              className="ef2-text-input"
              placeholder={`e.g. Coffee, Grocery, Uber…`}
              value={item}
              onChange={e => setItem(e.target.value)}
              disabled={loading}
              autoComplete="off"
              required
            />
          </div>
        </div>

        {/* ══ STEP 4 — Receipt Options (Poză, Galerie, Digital) ══════ */}
        <div className="ef2-section">
          <p className="ef2-section-label">Atașează Bon (Opțional)</p>
          
          <div className="receipt-buttons-grid">
            <button
              type="button"
              className="receipt-btn"
              disabled={loading || scanning}
              onClick={() => cameraInputRef.current?.click()}
            >
              <span className="receipt-btn__icon">📸</span>
              <span className="receipt-btn__text">Fă o poză</span>
            </button>

            <button
              type="button"
              className="receipt-btn"
              disabled={loading || scanning}
              onClick={() => galleryInputRef.current?.click()}
            >
              <span className="receipt-btn__icon">🖼️</span>
              <span className="receipt-btn__text">Din Galerie</span>
            </button>

            <button
              type="button"
              className="receipt-btn"
              disabled={loading || scanning}
              onClick={() => digitalInputRef.current?.click()}
            >
              <span className="receipt-btn__icon">📄</span>
              <span className="receipt-btn__text">Bon Digital</span>
            </button>
          </div>

          {/* Scanning status */}
          {scanning && (
            <div className="receipt-scanning">
              <span className="spinner spinner--sm" />
              <span>Se analizează bonul cu OCR...</span>
            </div>
          )}

          {/* OCR Notice */}
          {ocrNotice && !scanning && (
            <div className="receipt-notice" role="status">
              {ocrNotice}
            </div>
          )}

          {/* Attached Receipt Preview */}
          {receipt && !scanning && (
            <div className="receipt-preview-card">
              <div className="receipt-preview-thumb">
                {receipt.type === 'pdf' ? (
                  <span className="receipt-pdf-icon">📄 PDF</span>
                ) : (
                  <img src={receipt.previewUrl} alt="Preview Bon" />
                )}
              </div>
              <div className="receipt-preview-info">
                <span className="receipt-preview-name">{receipt.name}</span>
                <span className="receipt-preview-status">✅ Atașat la baza de date</span>
              </div>
              <button
                type="button"
                className="receipt-remove-btn"
                title="Șterge bonul"
                onClick={removeReceipt}
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* ══ STEP 5 — When ════════════════════════════════════════ */}
        <div className="ef2-section">
          <p className="ef2-section-label">When</p>
          <div className="ef2-date-chips">
            {['Now','Yesterday'].map((lbl, idx) => (
              <button
                key={lbl}
                type="button"
                disabled={loading}
                className={`ef2-chip ${quickDate === idx && !showDP ? 'ef2-chip--on' : ''}`}
                onClick={() => handleQuickDate(idx)}
              >
                {lbl === 'Now' ? '⚡' : '🕐'} {lbl}
              </button>
            ))}
            <button
              type="button"
              disabled={loading}
              className={`ef2-chip ${showDP ? 'ef2-chip--on' : ''}`}
              onClick={() => { setShowDP(v => !v); setQuickDate(null); }}
            >
              📅 Custom
            </button>
          </div>
          {showDP && (
            <input
              id="ef-datetime"
              type="datetime-local"
              className="ef2-datetime"
              value={datetime}
              onChange={e => { setDatetime(e.target.value); setQuickDate(null); }}
              disabled={loading}
            />
          )}
        </div>

        {/* ── Error ─────────────────────────────────────────────── */}
        {error && (
          <div className="ef2-error" role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {error}
          </div>
        )}

        {/* ── Submit ────────────────────────────────────────────── */}
        <button
          type="submit"
          className="ef2-submit"
          disabled={loading || scanning}
          style={{ '--ch': cat.hex, '--cg': cat.glow }}
          id="add-expense-btn"
        >
          <span className="ef2-submit__shimmer" aria-hidden="true" />
          {loading ? (
            <>
              <span className="ef2-spinner" aria-hidden="true" />
              <span>Saving…</span>
            </>
          ) : (
            <>
              <span className="ef2-submit__icon">{cat.icon}</span>
              <span>Add {cat.label}</span>
              <svg className="ef2-submit__arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </>
          )}
        </button>

      </form>
    </div>
  );
}
