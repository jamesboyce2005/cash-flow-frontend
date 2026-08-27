import React, { useState, useEffect } from 'react';
import { db } from '../db';
import './ReservesGrid.css';

function ReservesGrid({ onReservesChange }) {
  const [reserves, setReserves] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newReserve, setNewReserve] = useState({ name: '', amount: '' });

  const [editingId, setEditingId] = useState(null);
  const [editAmount, setEditAmount] = useState('');

  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    fetchReserves();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchReserves = async () => {
    try {
      const data = await db.getReserves();
      setReserves(data);
    } catch (error) {
      console.error('Error fetching reserves:', error);
    }
  };

  const refreshAll = async () => {
    await fetchReserves();
    if (onReservesChange) onReservesChange();
  };

  const handleAddReserve = async (e) => {
    e.preventDefault();

    if (!newReserve.name || !newReserve.amount) {
      alert('Please fill in name and amount');
      return;
    }

    try {
      await db.addReserve({
        name: newReserve.name,
        amount: parseFloat(newReserve.amount)
      });
      setNewReserve({ name: '', amount: '' });
      setShowAddForm(false);
      refreshAll();
    } catch (error) {
      console.error('Error adding reserve:', error);
      alert('Failed to add reserve');
    }
  };

  const startEditAmount = (reserve) => {
    setEditingId(reserve.id);
    setEditAmount(reserve.amount.toString());
  };

  const saveAmount = async (id) => {
    try {
      await db.updateReserve(id, { amount: parseFloat(editAmount) || 0 });
      setEditingId(null);
      refreshAll();
    } catch (error) {
      console.error('Error updating reserve amount:', error);
      alert('Failed to update amount');
    }
  };

  const cancelEditAmount = () => {
    setEditingId(null);
    setEditAmount('');
  };

  const startRename = (reserve) => {
    setRenamingId(reserve.id);
    setRenameValue(reserve.name);
  };

  const saveRename = async (id) => {
    try {
      await db.updateReserve(id, { name: renameValue });
      setRenamingId(null);
      refreshAll();
    } catch (error) {
      console.error('Error renaming reserve:', error);
      alert('Failed to rename');
    }
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue('');
  };

  const deleteReserve = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;

    try {
      await db.deleteReserve(id);
      refreshAll();
    } catch (error) {
      console.error('Error deleting reserve:', error);
      alert('Failed to delete reserve');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const totalReserves = reserves.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

  return (
    <div className="reserves-container">
      <div className="reserves-summary">
        <h2>Total Reserves</h2>
        <div className="amount">{formatCurrency(totalReserves)}</div>
        <p className="formula">Set aside for emergencies, taxes, upcoming expenses, etc.</p>
      </div>

      <div className="reserves-actions">
        <button onClick={() => setShowAddForm(!showAddForm)} className="add-reserve-btn">
          {showAddForm ? '✕ Cancel' : '+ Add Reserve'}
        </button>
      </div>

      {showAddForm && (
        <div className="add-reserve-form">
          <h3>Add New Reserve</h3>
          <form onSubmit={handleAddReserve}>
            <div className="form-group">
              <label>Reserve Name:</label>
              <input
                type="text"
                value={newReserve.name}
                onChange={(e) => setNewReserve({ ...newReserve, name: e.target.value })}
                placeholder="e.g., Emergency Fund"
                required
              />
            </div>
            <div className="form-group">
              <label>Amount:</label>
              <input
                type="number"
                step="0.01"
                value={newReserve.amount}
                onChange={(e) => setNewReserve({ ...newReserve, amount: e.target.value })}
                placeholder="0.00"
                required
              />
            </div>
            <button type="submit" className="submit-btn">Add Reserve</button>
          </form>
        </div>
      )}

      <div className="reserves-list">
        {reserves.length === 0 ? (
          <div className="empty-state">
            <p>No reserves yet. Click "+ Add Reserve" to set aside money for emergencies, taxes, or upcoming expenses.</p>
          </div>
        ) : (
          reserves.map((reserve) => (
            <div key={reserve.id} className="reserve-card">
              <div className="reserve-info">
                {renamingId === reserve.id ? (
                  <div className="rename-input">
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      autoFocus
                    />
                    <button onClick={() => saveRename(reserve.id)} className="save-btn">✓</button>
                    <button onClick={cancelRename} className="cancel-btn">✕</button>
                  </div>
                ) : (
                  <h3>{reserve.name}</h3>
                )}
              </div>

              {editingId === reserve.id ? (
                <div className="edit-amount">
                  <input
                    type="number"
                    step="0.01"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    autoFocus
                  />
                  <button onClick={() => saveAmount(reserve.id)} className="save-btn">✓</button>
                  <button onClick={cancelEditAmount} className="cancel-btn">✕</button>
                </div>
              ) : (
                <div className="reserve-amount clickable" onClick={() => startEditAmount(reserve)}>
                  {formatCurrency(reserve.amount)}
                </div>
              )}

              <div className="reserve-actions">
                <button onClick={() => startRename(reserve)} className="action-btn" title="Rename">✏️</button>
                <button onClick={() => deleteReserve(reserve.id, reserve.name)} className="action-btn delete" title="Delete">🗑️</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ReservesGrid;
