import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Bills.css';

function Bills({ token, apiUrl }) {
  const [bills, setBills] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBill, setNewBill] = useState({ name: '', amount: '', due_day: '' });
  const [loading, setLoading] = useState(false);

  const axiosConfig = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const fetchBills = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${apiUrl}/api/bills`, axiosConfig);
      setBills(response.data.bills);
    } catch (error) {
      console.error('Error fetching bills:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, []);

  const handleAddBill = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${apiUrl}/api/bills`, newBill, axiosConfig);
      setNewBill({ name: '', amount: '', due_day: '' });
      setShowAddForm(false);
      fetchBills();
    } catch (error) {
      console.error('Error adding bill:', error);
    }
  };

  const togglePaid = async (billId) => {
    try {
      await axios.patch(`${apiUrl}/api/bills/${billId}/toggle-paid`, {}, axiosConfig);
      fetchBills();
    } catch (error) {
      console.error('Error toggling bill:', error);
    }
  };

  const deleteBill = async (billId) => {
    if (window.confirm('Are you sure you want to delete this bill?')) {
      try {
        await axios.delete(`${apiUrl}/api/bills/${billId}`, axiosConfig);
        fetchBills();
      } catch (error) {
        console.error('Error deleting bill:', error);
      }
    }
  };

  const totalBills = bills.reduce((sum, bill) => sum + parseFloat(bill.amount), 0);
  const unpaidBills = bills.filter(b => !b.is_paid).reduce((sum, bill) => sum + parseFloat(bill.amount), 0);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="bills-container">
      <div className="bills-summary">
        <div className="summary-item">
          <h3>Total Bills This Month</h3>
          <div className="amount">{formatCurrency(totalBills)}</div>
        </div>
        <div className="summary-item unpaid">
          <h3>Unpaid Bills</h3>
          <div className="amount">{formatCurrency(unpaidBills)}</div>
        </div>
      </div>

      <div className="bills-actions">
        <button onClick={() => setShowAddForm(!showAddForm)} className="add-bill-btn">
          {showAddForm ? 'Cancel' : '+ Add Bill'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddBill} className="add-bill-form">
          <input
            type="text"
            placeholder="Bill name"
            value={newBill.name}
            onChange={(e) => setNewBill({ ...newBill, name: e.target.value })}
            required
          />
          <input
            type="number"
            step="0.01"
            placeholder="Amount"
            value={newBill.amount}
            onChange={(e) => setNewBill({ ...newBill, amount: e.target.value })}
            required
          />
          <input
            type="number"
            min="1"
            max="31"
            placeholder="Due day of month"
            value={newBill.due_day}
            onChange={(e) => setNewBill({ ...newBill, due_day: e.target.value })}
          />
          <button type="submit">Add Bill</button>
        </form>
      )}

      <div className="bills-list">
        {loading ? (
          <p>Loading bills...</p>
        ) : bills.length === 0 ? (
          <p className="empty-message">No bills for this month. Click "Add Bill" to get started.</p>
        ) : (
          [...bills]
            .sort((a, b) => {
              // Unpaid first, then by due day
              if (a.is_paid !== b.is_paid) return a.is_paid ? 1 : -1;
              return (a.due_day || 99) - (b.due_day || 99);
            })
            .map((bill) => (
            <div key={bill.id} className={`bill-card ${bill.is_paid ? 'paid' : 'unpaid'}`}>
              <div className="bill-info">
                <h4>{bill.name}</h4>
                <p className="bill-amount">{formatCurrency(bill.amount)}</p>
                {bill.due_day && <p className="bill-due">Due: Day {bill.due_day}</p>}
              </div>
              <div className="bill-actions">
                <button
                  onClick={() => togglePaid(bill.id)}
                  className={`pay-btn ${bill.is_paid ? 'paid' : ''}`}
                >
                  {bill.is_paid ? '✓ Paid' : 'Mark Paid'}
                </button>
                <button onClick={() => deleteBill(bill.id)} className="delete-btn">
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
