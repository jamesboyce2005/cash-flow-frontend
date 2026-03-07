import React, { useState, useEffect } from 'react';
import { db } from '../db';
import './Bills.css';

function Bills() {
  const [bills, setBills] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBill, setNewBill] = useState({
    name: '',
    amount: '',
    due_day: ''
  });

  useEffect(() => {
    fetchBills();
  }, []);

  const fetchBills = async () => {
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      
      const billsData = await db.getBills(month, year);
      setBills(billsData);
    } catch (error) {
      console.error('Error fetching bills:', error);
    }
  };

  const handleAddBill = async (e) => {
    e.preventDefault();
    
    if (!newBill.name || !newBill.amount || !newBill.due_day) {
      alert('Please fill in all fields');
      return;
    }

    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      await db.addBill({
        name: newBill.name,
        amount: parseFloat(newBill.amount),
        due_day: parseInt(newBill.due_day),
        month,
        year,
        is_paid: false
      });

      setNewBill({ name: '', amount: '', due_day: '' });
      setShowAddForm(false);
      fetchBills();
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
      fetchBills();
    } catch (error) {
      console.error('Error toggling bill status:', error);
    }
  };

  const deleteBill = async (billId, billName) => {
    if (!window.confirm(`Delete "${billName}"?`)) {
      return;
    }

    try {
      await db.deleteBill(billId);
      fetchBills();
    } catch (error) {
      console.error('Error deleting bill:', error);
      alert('Failed to delete bill');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

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
            <div key={bill.id} className={`bill-card ${bill.is_paid ? 'paid' : 'unpaid'}`}>
              <div className="bill-info">
                <h3>{bill.name}</h3>
                <p className="due-date">Due: Day {bill.due_day}</p>
              </div>
              <div className="bill-amount">
                {formatCurrency(bill.amount)}
              </div>
              <div className="bill-actions">
                <button
                  onClick={() => togglePaid(bill.id, bill.is_paid)}
                  className={`status-btn ${bill.is_paid ? 'paid' : 'unpaid'}`}
                >
                  {bill.is_paid ? '✓ Paid' : 'Mark Paid'}
                </button>
                <button
                  onClick={() => deleteBill(bill.id, bill.name)}
                  className="delete-btn"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Bills;
