import React, { useState, useEffect } from 'react';
import { db } from '../db';
import './Bills.css';

function Bills({ onBillsChange }) {
  const [bills, setBills] = useState([]);
  const [paidHistory, setPaidHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBill, setNewBill] = useState({
    name: '',
    amount: '',
    due_day: ''
  });

  // Editing an existing bill
  const [editingBillId, setEditingBillId] = useState(null);
  const [editBill, setEditBill] = useState({ name: '', amount: '', due_day: '' });

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // How many months of paid history to show by default
  const HISTORY_MONTHS_BACK = 3;

  useEffect(() => {
    fetchBills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show this month's bills PLUS any still-unpaid bills from earlier months
  // (so something that straddles months doesn't just vanish). Paid bills from
  // past months move to the separate Paid History section instead.
  const fetchBills = async () => {
    try {
      const allBills = await db.getAllBills();

      const isBeforeCurrentMonth = (b) =>
        b.year < currentYear || (b.year === currentYear && b.month < currentMonth);

      const relevant = allBills.filter(b =>
        (b.month === currentMonth && b.year === currentYear) ||
        (!b.is_paid && isBeforeCurrentMonth(b))
      );

      // Unpaid first, then scheduled, then paid; sorted by due day within each group
      relevant.sort((a, b) => {
        const rank = (bill) => (bill.is_paid ? 2 : bill.is_scheduled ? 1 : 0);
        const rankDiff = rank(a) - rank(b);
        if (rankDiff !== 0) return rankDiff;
        return a.due_day - b.due_day;
      });

      setBills(relevant);

      // Paid history: paid bills from strictly past months, most recent first
      const cutoff = new Date(currentYear, currentMonth - 1 - HISTORY_MONTHS_BACK, 1);
      const history = allBills
        .filter(b => b.is_paid && isBeforeCurrentMonth(b))
        .filter(b => new Date(b.year, b.month - 1, 1) >= cutoff)
        .sort((a, b) => {
          if (a.year !== b.year) return b.year - a.year;
          if (a.month !== b.month) return b.month - a.month;
          return a.due_day - b.due_day;
        });
      setPaidHistory(history);
    } catch (error) {
      console.error('Error fetching bills:', error);
    }
  };

  // Refresh this tab's list AND tell Dashboard to recalculate Unpaid Bills / True Available Cash
  const refreshAll = async () => {
    await fetchBills();
    if (onBillsChange) {
      onBillsChange();
    }
  };

  const handleAddBill = async (e) => {
    e.preventDefault();

    if (!newBill.name || !newBill.amount || !newBill.due_day) {
      alert('Please fill in all fields');
      return;
    }

    try {
      await db.addBill({
        name: newBill.name,
        amount: parseFloat(newBill.amount),
        due_day: parseInt(newBill.due_day),
        month: currentMonth,
        year: currentYear,
        is_paid: false,
        is_scheduled: false
      });

      setNewBill({ name: '', amount: '', due_day: '' });
      setShowAddForm(false);
      refreshAll();
    } catch (error) {
      console.error('Error adding bill:', error);
      alert('Failed to add bill');
    }
  };

  const togglePaid = async (billId, currentStatus) => {
    try {
      await db.updateBill(billId, {
        is_paid: !currentStatus
      });
      refreshAll();
    } catch (error) {
      console.error('Error toggling bill status:', error);
    }
  };

  const toggleScheduled = async (billId) => {
    try {
      await db.toggleBillScheduled(billId);
      refreshAll();
    } catch (error) {
      console.error('Error toggling scheduled status:', error);
    }
  };

  const unmarkPaid = async (billId, billName) => {
    if (!window.confirm(`Mark "${billName}" as unpaid again?`)) return;

    try {
      await db.updateBill(billId, { is_paid: false });
      refreshAll();
    } catch (error) {
      console.error('Error unmarking bill as paid:', error);
      alert('Failed to update bill');
    }
  };

  const deleteBill = async (billId, billName) => {
    if (!window.confirm(`Delete "${billName}"?`)) {
      return;
    }

    try {
      await db.deleteBill(billId);
      refreshAll();
    } catch (error) {
      console.error('Error deleting bill:', error);
      alert('Failed to delete bill');
    }
  };

  const startEditBill = (bill) => {
    setEditingBillId(bill.id);
    setEditBill({
      name: bill.name,
      amount: bill.amount.toString(),
      due_day: bill.due_day.toString()
    });
  };

  const cancelEditBill = () => {
    setEditingBillId(null);
    setEditBill({ name: '', amount: '', due_day: '' });
  };

  const saveEditBill = async (billId) => {
    if (!editBill.name || !editBill.amount || !editBill.due_day) {
      alert('Please fill in all fields');
      return;
    }

    try {
      await db.updateBill(billId, {
        name: editBill.name,
        amount: parseFloat(editBill.amount),
        due_day: parseInt(editBill.due_day)
      });

      setEditingBillId(null);
      refreshAll();
    } catch (error) {
      console.error('Error updating bill:', error);
      alert('Failed to update bill');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const isCarriedForward = (bill) =>
    bill.year < currentYear || (bill.year === currentYear && bill.month < currentMonth);

  const totalBills = bills.reduce((sum, bill) => sum + parseFloat(bill.amount), 0);
  const paidBills = bills.filter(b => b.is_paid).reduce((sum, bill) => sum + parseFloat(bill.amount), 0);
  const unpaidBills = totalBills - paidBills;

  return (
    <div className="bills-container">
      <div className="bills-summary">
        <div className="summary-item">
          <span className="label">Total Bills:</span>
          <span className="value">{formatCurrency(totalBills)}</span>
        </div>
        <div className="summary-item">
          <span className="label">Paid:</span>
          <span className="value paid">{formatCurrency(paidBills)}</span>
        </div>
        <div className="summary-item">
          <span className="label">Unpaid:</span>
          <span className="value unpaid">{formatCurrency(unpaidBills)}</span>
        </div>
      </div>

      <div className="bills-actions">
        <button onClick={() => setShowAddForm(!showAddForm)} className="add-bill-btn">
          {showAddForm ? '✕ Cancel' : '+ Add Bill'}
        </button>
      </div>

      {showAddForm && (
        <div className="add-bill-form">
          <h3>Add New Bill</h3>
          <form onSubmit={handleAddBill}>
            <div className="form-group">
              <label>Bill Name:</label>
              <input
                type="text"
                value={newBill.name}
                onChange={(e) => setNewBill({ ...newBill, name: e.target.value })}
                placeholder="e.g., Electric Bill"
                required
              />
            </div>

            <div className="form-group">
              <label>Amount:</label>
              <input
                type="number"
                step="0.01"
                value={newBill.amount}
                onChange={(e) => setNewBill({ ...newBill, amount: e.target.value })}
                placeholder="0.00"
                required
              />
            </div>

            <div className="form-group">
              <label>Due Day of Month:</label>
              <input
                type="number"
                min="1"
                max="31"
                value={newBill.due_day}
                onChange={(e) => setNewBill({ ...newBill, due_day: e.target.value })}
                placeholder="15"
                required
              />
            </div>

            <button type="submit" className="submit-btn">Add Bill</button>
          </form>
        </div>
      )}

      <div className="bills-list">
        {bills.length === 0 ? (
          <div className="empty-state">
            <p>No bills for this month. Click "+ Add Bill" to get started.</p>
          </div>
        ) : (
          bills.map((bill) => (
            <div
              key={bill.id}
              className={`bill-card ${bill.is_paid ? 'paid' : bill.is_scheduled ? 'scheduled' : 'unpaid'}`}
            >
              {editingBillId === bill.id ? (
                <div className="bill-edit-form">
                  <div className="form-group">
                    <label>Bill Name:</label>
                    <input
                      type="text"
                      value={editBill.name}
                      onChange={(e) => setEditBill({ ...editBill, name: e.target.value })}
                      autoFocus
                    />
                  </div>
                  <div className="form-group">
                    <label>Amount:</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editBill.amount}
                      onChange={(e) => setEditBill({ ...editBill, amount: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Due Day of Month:</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={editBill.due_day}
                      onChange={(e) => setEditBill({ ...editBill, due_day: e.target.value })}
                    />
                  </div>
                  <div className="bill-edit-actions">
                    <button onClick={() => saveEditBill(bill.id)} className="save-btn">✓ Save</button>
                    <button onClick={cancelEditBill} className="cancel-btn">✕ Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="bill-info">
                    <h3>
                      {bill.is_scheduled && !bill.is_paid && (
                        <span className="scheduled-icon" title="Scheduled — autopay queued, not yet cleared">🕓</span>
                      )}
                      {bill.name}
                      {isCarriedForward(bill) && (
                        <span className="carried-badge" title={`From ${monthNames[bill.month - 1]} ${bill.year}`}>
                          ⚠️ from {monthNames[bill.month - 1]}
                        </span>
                      )}
                    </h3>
                    <p className="due-date">Due: Day {bill.due_day}</p>
                  </div>
                  <div className="bill-amount">
                    {formatCurrency(bill.amount)}
                  </div>
                  <div className="bill-actions">
                    {!bill.is_paid && (
                      <button
                        onClick={() => toggleScheduled(bill.id)}
                        className={`status-btn scheduled-btn ${bill.is_scheduled ? 'active' : ''}`}
                        title="Toggle scheduled — autopay queued but not yet cleared"
                      >
                        🕓 {bill.is_scheduled ? 'Scheduled' : 'Schedule'}
                      </button>
                    )}
                    <button
                      onClick={() => togglePaid(bill.id, bill.is_paid)}
                      className={`status-btn ${bill.is_paid ? 'paid' : 'unpaid'}`}
                    >
                      {bill.is_paid ? '✓ Paid' : 'Mark Paid'}
                    </button>
                    <button
                      onClick={() => startEditBill(bill)}
                      className="edit-btn"
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => deleteBill(bill.id, bill.name)}
                      className="delete-btn"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

      <div className="paid-history-section">
        <button className="paid-history-toggle" onClick={() => setShowHistory(!showHistory)}>
          {showHistory ? '▼' : '▶'} Paid History ({paidHistory.length})
        </button>
        {showHistory && (
          <div className="paid-history-list">
            {paidHistory.length === 0 ? (
              <p className="detail-empty">No paid bills in the last {HISTORY_MONTHS_BACK} months.</p>
            ) : (
              paidHistory.map((bill) => (
                <div key={bill.id} className="paid-history-item">
                  <div className="paid-history-info">
                    <span className="paid-history-name">{bill.name}</span>
                    <span className="paid-history-month">{monthNames[bill.month - 1]} {bill.year}</span>
                  </div>
                  <span className="paid-history-amount">{formatCurrency(bill.amount)}</span>
                  <button
                    onClick={() => unmarkPaid(bill.id, bill.name)}
                    className="unmark-paid-btn"
                    title="Undo — mark this bill unpaid again"
                  >
                    Unmark Paid
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Bills;
