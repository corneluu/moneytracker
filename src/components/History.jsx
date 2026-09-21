import React, { useState } from 'react';
import { getMonthCycle, formatCycleRange } from '../utils/date.js';
import { updateExpense, deleteExpense } from '../utils/sheets.js';
import { SALARY } from '../utils/constants.js';

const CATEGORIES = ['Food', 'Transport', 'Entertainment', 'Shopping', 'Health', 'Bills', 'Other'];

const CATEGORY_EMOJI = {
  Food: '🍔',
  Transport: '🚗',
  Entertainment: '🎮',
  Shopping: '🛍️',
  Health: '💊',
  Bills: '🧾',
  Other: '📦',
};

const TYPE_BADGE = {
  expense: { label: 'Expense', cls: 'badge--expense' },
  subscription: { label: 'Sub', cls: 'badge--subscription' },
};

export default function History({ expenses, onExpenseUpdated, onExpenseDeleted }) {
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [loadingId, setLoadingId] = useState(null);
  const [error, setError] = useState(null);

  // Modal for receipt viewing
  const [viewReceipt, setViewReceipt] = useState(null);

  // Normalize and group by effective cycle descending
  const normalizedExpenses = expenses.map(e => ({
    ...e,
    effectiveCycle: (e.timestamp ? getMonthCycle(e.timestamp) : e.monthCycle) || 'Unknown'
  }));

  const cycleMap = {};
  for (const e of normalizedExpenses) {
    const cycle = e.effectiveCycle;
    if (!cycleMap[cycle]) cycleMap[cycle] = [];
    cycleMap[cycle].push(e);
  }
  const sortedCycles = Object.keys(cycleMap).sort((a, b) => (a > b ? -1 : 1));

  function startEdit(expense) {
    setEditId(expense.id);
    const dt = new Date(expense.timestamp);
    const pad = (n) => String(n).padStart(2, '0');
    const local = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    setEditForm({
      item: expense.item,
      datetime: local,
      category: expense.category,
      price: String(expense.price),
    });
    setError(null);
  }

  function cancelEdit() {
    setEditId(null);
    setEditForm({});
    setError(null);
  }

  async function saveEdit(expense) {
    setError(null);
    const priceNum = parseFloat(editForm.price);
    if (!editForm.item?.trim()) return setError('Item name is required.');
    if (isNaN(priceNum) || priceNum <= 0) return setError('Price must be a positive number.');
    if (!editForm.datetime) return setError('Date & time is required.');

    const isoTimestamp = new Date(editForm.datetime).toISOString();
    const monthCycle = getMonthCycle(isoTimestamp);

    const updated = {
      ...expense,
      item: editForm.item.trim(),
      timestamp: isoTimestamp,
      category: editForm.category,
      price: priceNum,
      monthCycle,
    };

    setLoadingId(expense.id);
    try {
      await updateExpense(expense.rowIndex, updated);
      onExpenseUpdated(updated);
      setEditId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingId(null);
    }
  }

  async function handleToggleReimburse(expense) {
    setError(null);
    setLoadingId(expense.id);
    const updated = {
      ...expense,
      reimbursed: !expense.reimbursed,
    };
    try {
      await updateExpense(expense.rowIndex, updated);
      onExpenseUpdated(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingId(null);
    }
  }

  async function handleDelete(expense) {
    if (!window.confirm(`Delete "${expense.item}"?`)) return;
    setError(null);
    setLoadingId(expense.id);
    try {
      await deleteExpense(expense.rowIndex);
      onExpenseDeleted(expense.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingId(null);
    }
  }

  const fmt = (n) =>
    n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (sortedCycles.length === 0) {
    return (
      <section className="card history-card" aria-label="Expense History">
        <h2 className="card__title"><span className="card__icon">📜</span> History</h2>
        <p className="empty-state">No expenses yet. Add your first one above!</p>
      </section>
    );
  }

  return (
    <section className="card history-card" aria-label="Expense History">
      <h2 className="card__title"><span className="card__icon">📜</span> History</h2>

      {error && <div className="alert alert--error mb-2" role="alert">{error}</div>}

      {/* Modal Lightbox for Viewing Receipt */}
      {viewReceipt && (
        <div className="receipt-modal-backdrop" onClick={() => setViewReceipt(null)}>
          <div className="receipt-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="receipt-modal-header">
              <h3>🧾 Bon — {viewReceipt.item}</h3>
              <button className="receipt-modal-close" onClick={() => setViewReceipt(null)}>✕</button>
            </div>
            <div className="receipt-modal-body">
              {viewReceipt.receipt.startsWith('data:application/pdf') ? (
                <iframe src={viewReceipt.receipt} title="Bon Digital PDF" className="receipt-pdf-frame" />
              ) : (
                <img src={viewReceipt.receipt} alt={`Bon ${viewReceipt.item}`} className="receipt-modal-img" />
              )}
            </div>
          </div>
        </div>
      )}

      {sortedCycles.map((cycle) => {
        const entries = cycleMap[cycle];
        const cycleSpent = entries.reduce((s, e) => s + (e.reimbursed ? 0 : e.price), 0);
        const cycleReimbursed = entries.reduce((s, e) => s + (e.reimbursed ? e.price : 0), 0);
        const cycleSaved = SALARY - cycleSpent;

        return (
          <div key={cycle} className="cycle-group">
            <div className="cycle-group__header">
              <div className="cycle-group__label">
                <span className="cycle-tag">{formatCycleRange(cycle)}</span>
              </div>
              <div className="cycle-group__stats">
                <span className="cycle-stat cycle-stat--spent">
                  Spent: <strong>{fmt(cycleSpent)} RON</strong>
                  {cycleReimbursed > 0 && (
                    <span className="cycle-stat-reimbursed-label"> (Decontat: {fmt(cycleReimbursed)} RON)</span>
                  )}
                </span>
                <span className={`cycle-stat ${cycleSaved < 0 ? 'cycle-stat--negative' : 'cycle-stat--saved'}`}>
                  Saved: <strong>{fmt(cycleSaved)} RON</strong>
                </span>
              </div>
            </div>

            <ul className="expense-list">
              {entries
                .slice()
                .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
                .map((expense) => (
                  <li key={expense.id} className={`expense-item ${expense.reimbursed ? 'expense-item--reimbursed' : ''}`}>
                    {editId === expense.id ? (
                      <div className="expense-edit-form">
                        <div className="form-row">
                          <div className="form-group">
                            <label>Item</label>
                            <input
                              type="text"
                              value={editForm.item}
                              onChange={(e) => setEditForm((f) => ({ ...f, item: e.target.value }))}
                              disabled={loadingId === expense.id}
                            />
                          </div>
                          <div className="form-group">
                            <label>Date &amp; Time</label>
                            <input
                              type="datetime-local"
                              value={editForm.datetime}
                              onChange={(e) => setEditForm((f) => ({ ...f, datetime: e.target.value }))}
                              disabled={loadingId === expense.id}
                            />
                          </div>
                        </div>
                        <div className="form-row">
                          <div className="form-group">
                            <label>Category</label>
                            <select
                              value={editForm.category}
                              onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                              disabled={loadingId === expense.id}
                            >
                              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Price (RON)</label>
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={editForm.price}
                              onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))}
                              disabled={loadingId === expense.id}
                            />
                          </div>
                        </div>
                        <div className="edit-actions">
                          <button
                            className="btn btn--primary btn--sm"
                            onClick={() => saveEdit(expense)}
                            disabled={loadingId === expense.id}
                            id={`save-edit-${expense.id}`}
                          >
                            {loadingId === expense.id ? <span className="spinner" /> : 'Save'}
                          </button>
                          <button
                            className="btn btn--ghost btn--sm"
                            onClick={cancelEdit}
                            disabled={loadingId === expense.id}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="expense-row">
                        <div className="expense-row__info">
                          <span className="expense-emoji">{CATEGORY_EMOJI[expense.category] || '💸'}</span>
                          <div className="expense-details">
                            <div className="expense-name-line">
                              <span className="expense-name">{expense.item}</span>
                              {expense.reimbursed && (
                                <span className="badge badge--decontat">✅ Decontat</span>
                              )}
                            </div>
                            <span className="expense-meta">
                              {expense.category} ·{' '}
                              {new Date(expense.timestamp).toLocaleString('ro-RO', {
                                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                              })}
                              <span className={`badge ${TYPE_BADGE[expense.type]?.cls || 'badge--expense'}`}>
                                {TYPE_BADGE[expense.type]?.label || expense.type}
                              </span>
                            </span>
                          </div>
                        </div>

                        <div className="expense-row__right">
                          <div className="expense-price-container">
                            {expense.reimbursed ? (
                              <div className="expense-price-box">
                                <span className="expense-price expense-price--struck"><s>{fmt(expense.price)} RON</s></span>
                                <span className="expense-price-effective">0.00 RON</span>
                              </div>
                            ) : (
                              <span className="expense-price">{fmt(expense.price)} RON</span>
                            )}
                          </div>

                          <div className="expense-actions">
                            {/* Receipt viewer button */}
                            {expense.receipt && (
                              <button
                                className="btn btn--icon btn--receipt"
                                title="Vezi Bon"
                                onClick={() => setViewReceipt(expense)}
                              >
                                🧾
                              </button>
                            )}

                            {/* Decontare Button */}
                            <button
                              className={`btn btn--decontare ${expense.reimbursed ? 'btn--decontare-active' : ''}`}
                              title={expense.reimbursed ? 'Anulează decontarea' : 'Decontează suma'}
                              onClick={() => handleToggleReimburse(expense)}
                              disabled={loadingId === expense.id}
                              id={`decontare-${expense.id}`}
                            >
                              {loadingId === expense.id ? (
                                <span className="spinner spinner--sm" />
                              ) : expense.reimbursed ? (
                                '✅ Decontat'
                              ) : (
                                '💸 Decontează'
                              )}
                            </button>

                            <button
                              className="btn btn--icon"
                              title="Edit"
                              onClick={() => startEdit(expense)}
                              disabled={!!loadingId}
                              id={`edit-${expense.id}`}
                            >
                              ✏️
                            </button>

                            <button
                              className="btn btn--icon btn--danger"
                              title="Delete"
                              onClick={() => handleDelete(expense)}
                              disabled={loadingId === expense.id}
                              id={`delete-${expense.id}`}
                            >
                              {loadingId === expense.id ? <span className="spinner spinner--sm" /> : '🗑️'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
