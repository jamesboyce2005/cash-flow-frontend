import React, { useState, useEffect } from 'react';
import { db } from '../db';
import './IncomeTracker.css';

function IncomeTracker({ onIncomeChange }) {
  const [income, setIncome] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEntry, setNewEntry] = useState({ name: '', amount: '', expected_date: '' });

  const [editingId, setEditingId] = useState(null);
  const [editEntry, setEditEntry] = useState({ name: '', amount: '', expected_date: '' });

  useEffect(() => {
    fetchIncome();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchIncome = async () => {
    try {
      const data = await db.getIncome();
      // Not-yet-received first, sorted by expected date
      data.sort((a, b) => {
        if (a.received !== b.received) return a.received ? 1 : -1;
        return (a.expected_date || '').localeCompare(b.expected_date || '');
      });
      setIncome(data);
    } catch (error) {
      console.error('Error fetching income:', error);
    }
  };

  const refreshAll = async () => {
    await fetchIncome();
    if (onIncomeChange) onIncomeChange();
  };

  const handleAddEntry = async (e) => {
    e.preventDefault();

    if (!newEntry.name || !newEntry.amount) {
      alert('Please fill in a name and amount');
      return;
    }

    try {
      await db.addIncome({
        name: newEntry.name,
        amount: parseFloat(newEntry.amount),
        expected_date: newEntry.expected_date || null,
        received: false
      });
      setNewEntry({ name: '', amount: '', expected_date: '' });
      setShowAddForm(false);
      refreshAll();
    } catch (error) {
      console.error('Error adding income entry:', error);
      alert('Failed to add entry');
    }
  };

  const toggleReceived = async (id, current) => {
    try {
      await db.updateIncome(id, { received: !current });
      refreshAll();
    } catch (error) {
      console.error('Error toggling received status:', error);
    }
  };

  const startEdit = (entry) => {
    setEditingId(entry.id);
    setEditEntry({
      name: entry.name,
      amount: entry.amount.toString(),
      expected_date: entry.expected_date || ''
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditEntry({ name: '', amount: '', expected_date: '' });
  };

  const saveEdit = async (id) => {
    if (!editEntry.name || !editEntry.amount) {
      alert('Please fill in a name and amount');
      return;
    }

    try {
      await db.updateIncome(id, {
        name: editEntry.name,
        amount: parseFloat(editEntry.amount),
        expected_date: editEntry.expected_date || null
      });
      setEditingId(null);
      refreshAll();
    } catch (error) {
      console.error('Error updating income entry:', error);
      alert('Failed to update entry');
    }
  };

  const deleteEntry = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;

    try {
      await db.deleteIncome(id);
      refreshAll();
    } catch (error) {
      console.error('Error deleting income entry:', error);
      alert('Failed to delete entry');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const totalExpected = income
    .filter(e => !e.received)
    .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

  return (
    <div className="income-container">
      <div className="income-summary">
        <h2>Expected Incoming Money</h2>
        <div className="amount">{formatCurrency(totalExpected)}</div>
        <p className="formula">Loans owed to you, pending transfers, or other money on the way (not yet received)</p>
      </div>

      <div className="income-actions">
        <button onClick={() => setShowAddForm(!showAddForm)} className="add-income-btn">
          {showAddForm ? '✕ Cancel' : '+ Add Expected Income'}
        </button>
      </div>

      {showAddForm && (
        <div className="add-income-form">
          <h3>Add Expected Income</h3>
          <form onSubmit={handleAddEntry}>
            <div className="form-group">
              <label>Description:</label>
              <input
                type="text"
                value={newEntry.name}
                onChange={(e) => setNewEntry({ ...newEntry, name: e.target.value })}
                placeholder="e.g., Loan repayment from John"
                required
              />
            </div>
            <div className="form-group">
              <label>Amount:</label>
              <input
                type="number"
                step="0.01"
                value={newEntry.amount}
                onChange={(e) => setNewEntry({ ...newEntry, amount: e.target.value })}
                placeholder="0.00"
                required
              />
            </div>
            <div className="form-group">
              <label>Expected Date (optional):</label>
              <input
                type="date"
                value={newEntry.expected_date}
                onChange={(e) => setNewEntry({ ...newEntry, expected_date: e.target.value })}
              />
            </div>
            <button type="submit" className="submit-btn">Add</button>
          </form>
        </div>
      )}

      <div className="income-list">
        {income.length === 0 ? (
          <div className="empty-state">
            <p>Nothing tracked yet. Add a loan owed to you, an incoming transfer, or any other money on the way.</p>
          </div>
        ) : (
          income.map((entry) => (
            <div key={entry.id} className={`income-card ${entry.received ? 'received' : 'pending'}`}>
              {editingId === entry.id ? (
                <div className="income-edit-form">
                  <div className="form-group">
                    <label>Description:</label>
                    <input
                      type="text"
                      value={editEntry.name}
                      onChange={(e) => setEditEntry({ ...editEntry, name: e.target.value })}
                      autoFocus
                    />
                  </div>
                  <div className="form-group">
                    <label>Amount:</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editEntry.amount}
                      onChange={(e) => setEditEntry({ ...editEntry, amount: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Expected Date:</label>
                    <input
                      type="date"
                      value={editEntry.expected_date}
                      onChange={(e) => setEditEntry({ ...editEntry, expected_date: e.target.value })}
                    />
                  </div>
                  <div className="income-edit-actions">
                    <button onClick={() => saveEdit(entry.id)} className="save-btn">✓ Save</button>
                    <button onClick={cancelEdit} className="cancel-btn">✕ Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="income-info">
                    <h3>{entry.name}</h3>
                    {entry.expected_date && (
                      <p className="expected-date">Expected: {new Date(entry.expected_date + 'T00:00:00').toLocaleDateString()}</p>
                    )}
                  </div>
                  <div className="income-amount">
                    {formatCurrency(entry.amount)}
                  </div>
                  <div className="income-actions-row">
                    <button
                      onClick={() => toggleReceived(entry.id, entry.received)}
                      className={`status-btn ${entry.received ? 'received' : 'pending'}`}
                    >
                      {entry.received ? '✓ Received' : 'Mark Received'}
                    </button>
                    <button onClick={() => startEdit(entry)} className="edit-btn" title="Edit">✏️</button>
                    <button onClick={() => deleteEntry(entry.id, entry.name)} className="delete-btn" title="Delete">🗑️</button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default IncomeTracker;
