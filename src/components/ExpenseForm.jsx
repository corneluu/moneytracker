import React, { useState } from 'react';
import { getMonthCycle, localDatetimeDefault } from '../utils/date.js';
import { appendExpense } from '../utils/sheets.js';

const CATEGORIES = ['Food', 'Transport', 'Entertainment', 'Shopping', 'Health'];

export default function ExpenseForm({ onExpenseAdded, expenses }) {
  const [item, setItem] = useState('');
  const [datetime, setDatetime] = useState(localDatetimeDefault());
  const [category, setCategory] = useState('Food');
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const priceNum = parseFloat(price);
    if (!item.trim()) return setError('Item name is required.');
    if (isNaN(priceNum) || priceNum <= 0) return setError('Price must be a positive number.');
    if (!datetime) return setError('Date & time is required.');

    const isoTimestamp = new Date(datetime).toISOString();
    const monthCycle = getMonthCycle(isoTimestamp);
    
    const maxId = expenses.reduce((max, e) => {
      const num = parseInt(e.id, 10);
      return !isNaN(num) && num > max ? num : max;
    }, 0);
    const id = String(maxId + 1);

    const expense = {
      id,
      timestamp: isoTimestamp,
      item: item.trim(),
      category,
      price: priceNum,
      type: 'expense',
      monthCycle,
    };

    setLoading(true);
    try {
      await appendExpense(expense);
      setSuccess(true);
      setItem('');
      setPrice('');
      setDatetime(localDatetimeDefault());
      setCategory('Food');
      onExpenseAdded(expense);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card expense-form-card" aria-label="Add Expense">
      <h2 className="card__title">
        <span className="card__icon">➕</span> Add Expense
      </h2>

      <form onSubmit={handleSubmit} className="form" noValidate>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="expense-item">Item</label>
            <input
              id="expense-item"
              type="text"
              placeholder="e.g. Coffee, Gym"
              value={item}
              onChange={(e) => setItem(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="expense-datetime">Date &amp; Time</label>
            <input
              id="expense-datetime"
              type="datetime-local"
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
              disabled={loading}
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="expense-category">Category</label>
            <select
              id="expense-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={loading}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="expense-price">Price (RON)</label>
            <input
              id="expense-price"
              type="number"
              placeholder="0.00"
              min="0.01"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              disabled={loading}
              required
            />
          </div>
        </div>

        {error && <div className="alert alert--error" role="alert">{error}</div>}
        {success && <div className="alert alert--success" role="status">✅ Expense added successfully!</div>}

        <button
          type="submit"
          className="btn btn--primary btn--full"
          disabled={loading}
          id="add-expense-btn"
        >
          {loading ? <span className="spinner" /> : 'Add Expense'}
        </button>
      </form>
    </section>
  );
}
