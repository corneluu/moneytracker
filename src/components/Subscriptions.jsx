import React, { useState } from 'react';
import {
  appendSubscription,
  updateSubscription,
  deleteSubscription,
  appendExpense,
} from '../utils/sheets.js';
import { getCurrentCycle, getCurrentCycleStartISO, getMonthCycle } from '../utils/date.js';

const CATEGORIES = ['Food', 'Transport', 'Entertainment', 'Shopping', 'Health'];

const CATEGORY_EMOJI = {
  Food: '🍔',
  Transport: '🚌',
  Entertainment: '🎬',
  Shopping: '🛍️',
  Health: '💊',
};

export default function Subscriptions({ subscriptions, expenses, onSubsChanged, onExpenseAdded }) {
  // Add form state
  const [form, setForm] = useState({ item: '', category: 'Food', price: '' });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState(null);
  const [addSuccess, setAddSuccess] = useState(false);

  // Run subscriptions state
  const [runLoading, setRunLoading] = useState(false);
  const [runError, setRunError] = useState(null);
  const [runSuccess, setRunSuccess] = useState(false);

  // Per-row loading/error
  const [rowLoading, setRowLoading] = useState({});
  const [rowError, setRowError] = useState({});

  const currentCycle = getCurrentCycle();

  // Check if this cycle already has subscription-type entries
  const cycleHasSubscriptions = expenses.some(
    (e) => e.monthCycle === currentCycle && e.type === 'subscription'
  );

  async function handleAdd(e) {
    e.preventDefault();
    setAddError(null);
    setAddSuccess(false);

    const priceNum = parseFloat(form.price);
    if (!form.item.trim()) return setAddError('Item name is required.');
    if (isNaN(priceNum) || priceNum <= 0) return setAddError('Price must be a positive number.');

    const sub = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      item: form.item.trim(),
      category: form.category,
      price: priceNum,
      active: true,
    };

    setAddLoading(true);
    try {
      await appendSubscription(sub);
      setAddSuccess(true);
      setForm({ item: '', category: 'Food', price: '' });
      onSubsChanged({ type: 'add', sub });
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  }

  async function toggleActive(sub) {
    setRowLoading((p) => ({ ...p, [sub.id]: true }));
    setRowError((p) => ({ ...p, [sub.id]: null }));
    try {
      const updated = { ...sub, active: !sub.active };
      await updateSubscription(sub.rowIndex, updated);
      onSubsChanged({ type: 'update', sub: updated });
    } catch (err) {
      setRowError((p) => ({ ...p, [sub.id]: err.message }));
    } finally {
      setRowLoading((p) => ({ ...p, [sub.id]: false }));
    }
  }

  async function handleDelete(sub) {
    if (!window.confirm(`Delete subscription "${sub.item}"? Past expenses will NOT be removed.`)) return;
    setRowLoading((p) => ({ ...p, [sub.id]: true }));
    setRowError((p) => ({ ...p, [sub.id]: null }));
    try {
      await deleteSubscription(sub.rowIndex);
      onSubsChanged({ type: 'delete', id: sub.id });
    } catch (err) {
      setRowError((p) => ({ ...p, [sub.id]: err.message }));
      setRowLoading((p) => ({ ...p, [sub.id]: false }));
    }
  }

  async function runSubscriptions() {
    setRunError(null);
    setRunSuccess(false);

    if (cycleHasSubscriptions) {
      setRunError('Already added subscriptions for this cycle.');
      return;
    }

    const activeOnes = subscriptions.filter((s) => s.active);
    if (activeOnes.length === 0) {
      setRunError('No active subscriptions to run.');
      return;
    }

    setRunLoading(true);
    const cycleStartISO = getCurrentCycleStartISO();
    const monthCycle = getCurrentCycle();
    const addedExpenses = [];

    try {
      for (const sub of activeOnes) {
        const expense = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: cycleStartISO,
          item: sub.item,
          category: sub.category,
          price: sub.price,
          type: 'subscription',
          monthCycle,
        };
        await appendExpense(expense);
        addedExpenses.push(expense);
      }
      addedExpenses.forEach((exp) => onExpenseAdded(exp));
      setRunSuccess(true);
    } catch (err) {
      setRunError(err.message);
    } finally {
      setRunLoading(false);
    }
  }

  const fmt = (n) =>
    n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <section className="card subscriptions-card" aria-label="Subscriptions Manager">
      <h2 className="card__title"><span className="card__icon">🔄</span> Subscriptions</h2>

      {/* Run Subscriptions */}
      <div className="run-subs-bar">
        <div className="run-subs-bar__info">
          <strong>{subscriptions.filter((s) => s.active).length}</strong> active subscription
          {subscriptions.filter((s) => s.active).length !== 1 ? 's' : ''}
        </div>
        <button
          className="btn btn--accent"
          onClick={runSubscriptions}
          disabled={runLoading || cycleHasSubscriptions}
          id="run-subscriptions-btn"
          title={cycleHasSubscriptions ? 'Already added for this cycle' : 'Append all active subs as expenses'}
        >
          {runLoading ? (
            <><span className="spinner" /> Running…</>
          ) : cycleHasSubscriptions ? (
            '✅ Already Added'
          ) : (
            '▶ Run Subscriptions'
          )}
        </button>
      </div>

      {runError && <div className="alert alert--error mb-2" role="alert">{runError}</div>}
      {runSuccess && (
        <div className="alert alert--success mb-2" role="status">
          ✅ Subscriptions added as expenses for the current cycle!
        </div>
      )}

      {/* Subscription list */}
      {subscriptions.length === 0 ? (
        <p className="empty-state">No subscriptions yet.</p>
      ) : (
        <ul className="sub-list">
          {subscriptions.map((sub) => (
            <li key={sub.id} className={`sub-item ${sub.active ? 'sub-item--active' : 'sub-item--inactive'}`}>
              <div className="sub-item__left">
                <span className="expense-emoji">{CATEGORY_EMOJI[sub.category] || '💳'}</span>
                <div className="sub-item__info">
                  <span className="sub-item__name">{sub.item}</span>
                  <span className="sub-item__meta">{sub.category} · {fmt(sub.price)} RON/cycle</span>
                </div>
              </div>
              <div className="sub-item__right">
                {rowError[sub.id] && (
                  <span className="row-error" title={rowError[sub.id]}>⚠️</span>
                )}
                <button
                  className={`toggle-btn ${sub.active ? 'toggle-btn--on' : 'toggle-btn--off'}`}
                  onClick={() => toggleActive(sub)}
                  disabled={rowLoading[sub.id]}
                  title={sub.active ? 'Deactivate' : 'Activate'}
                  id={`toggle-sub-${sub.id}`}
                  aria-pressed={sub.active}
                >
                  {rowLoading[sub.id] ? <span className="spinner spinner--sm" /> : sub.active ? 'ON' : 'OFF'}
                </button>
                <button
                  className="btn btn--icon btn--danger"
                  onClick={() => handleDelete(sub)}
                  disabled={rowLoading[sub.id]}
                  title="Delete subscription"
                  id={`delete-sub-${sub.id}`}
                >
                  🗑️
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Add new subscription */}
      <div className="add-sub-section">
        <h3 className="add-sub-title">Add Subscription</h3>
        <form onSubmit={handleAdd} className="form" noValidate>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="sub-item">Item</label>
              <input
                id="sub-item"
                type="text"
                placeholder="e.g. Netflix, Gym"
                value={form.item}
                onChange={(e) => setForm((f) => ({ ...f, item: e.target.value }))}
                disabled={addLoading}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="sub-category">Category</label>
              <select
                id="sub-category"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                disabled={addLoading}
              >
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="sub-price">Price (RON)</label>
              <input
                id="sub-price"
                type="number"
                placeholder="0.00"
                min="0.01"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                disabled={addLoading}
                required
              />
            </div>
          </div>

          {addError && <div className="alert alert--error" role="alert">{addError}</div>}
          {addSuccess && <div className="alert alert--success" role="status">✅ Subscription added!</div>}

          <button
            type="submit"
            className="btn btn--primary"
            disabled={addLoading}
            id="add-subscription-btn"
          >
            {addLoading ? <span className="spinner" /> : '+ Add Subscription'}
          </button>
        </form>
      </div>
    </section>
  );
}
