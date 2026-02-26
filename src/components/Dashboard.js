import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Bills from './Bills';
import './Dashboard.css';

function Dashboard({ user, token, onLogout, apiUrl }) {
  const [activeTab, setActiveTab] = useState('accounts');
  const [accounts, setAccounts] = useState([]);
  const [summary, setSummary] = useState({
    totalBankBalance: '0.00',
    totalCreditBalance: '0.00',
    netAvailableCash: '0.00',
  });
  const [unpaidBills, setUnpaidBills] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [renamingAccount, setRenamingAccount] = useState(null);
  const [newName, setNewName] = useState('');
  const [draggedItem, setDraggedItem] = useState(null);
  
  // New account form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAccount, setNewAccount] = useState({
    name: '',
    type: 'depository',
    balance: '',
    credit_limit: ''
  });
  
  // Edit balance (for bank accounts)
  const [editingBalance, setEditingBalance] = useState(null);
  const [editBalance, setEditBalance] = useState('');
  
  // Edit credit limit (for credit cards)
  const [editingCreditLimit, setEditingCreditLimit] = useState(null);
  const [editCreditLimit, setEditCreditLimit] = useState('');
  
  // Edit available credit (for credit cards)
  const [editingAvailableCredit, setEditingAvailableCredit] = useState(null);
  const [editAvailableCredit, setEditAvailableCredit] = useState('');

  const axiosConfig = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  // Fetch unpaid bills
  const fetchUnpaidBills = async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/bills`, axiosConfig);
      const unpaid = response.data.bills
        .filter(b => !b.is_paid)
        .reduce((sum, bill) => sum + parseFloat(bill.amount), 0);
      setUnpaidBills(unpaid);
    } catch (error) {
      console.error('Error fetching bills:', error);
    }
  };

  // Fetch accounts
  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${apiUrl}/api/accounts`, axiosConfig);
      setAccounts(response.data.accounts);
      setSummary(response.data.summary);
      await fetchUnpaidBills();
    } catch (err) {
      setError('Failed to fetch accounts');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, token]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Create new account
  const handleCreateAccount = async (e) => {
    e.preventDefault();
    
    if (!newAccount.name || !newAccount.balance) {
      alert('Please fill in account name and balance');
      return;
    }
    
    try {
      await axios.post(`${apiUrl}/api/accounts`, {
        name: newAccount.name,
        type: newAccount.type,
        balance: parseFloat(newAccount.balance),
        credit_limit: newAccount.type === 'credit' ? parseFloat(newAccount.credit_limit || 0) : null
      }, axiosConfig);
      
      // Reset form
      setNewAccount({ name: '', type: 'depository', balance: '', credit_limit: '' });
      setShowAddForm(false);
      
      // Refresh accounts
      fetchAccounts();
    } catch (error) {
      console.error('Error creating account:', error);
      alert('Failed to create account');
    }
  };

  // Update balance (bank accounts only)
  const startEditBalance = (account) => {
    setEditingBalance(account.id);
    setEditBalance(account.balance.toString());
  };

  const saveBalance = async (accountId) => {
    try {
      await axios.patch(
        `${apiUrl}/api/accounts/${accountId}/balance`,
        { balance: parseFloat(editBalance) },
        axiosConfig
      );
      
      setEditingBalance(null);
      fetchAccounts();
    } catch (error) {
      console.error('Error updating balance:', error);
      alert('Failed to update balance');
    }
  };

  const cancelEditBalance = () => {
    setEditingBalance(null);
    setEditBalance('');
  };

  // Update credit limit (credit cards only)
  const startEditCreditLimit = (account) => {
    setEditingCreditLimit(account.id);
    setEditCreditLimit(account.limit.toString());
  };

  const saveCreditLimit = async (accountId) => {
    try {
      await axios.patch(
        `${apiUrl}/api/accounts/${accountId}/credit-limit`,
        { credit_limit: parseFloat(editCreditLimit) },
        axiosConfig
      );
      
      setEditingCreditLimit(null);
      fetchAccounts();
    } catch (error) {
      console.error('Error updating credit limit:', error);
      alert('Failed to update credit limit');
    }
  };

  const cancelEditCreditLimit = () => {
    setEditingCreditLimit(null);
    setEditCreditLimit('');
  };

  // Update available credit (credit cards only)
  const startEditAvailableCredit = (account) => {
    setEditingAvailableCredit(account.id);
    setEditAvailableCredit(account.availableCredit.toString());
  };

  const saveAvailableCredit = async (accountId, currentLimit) => {
    try {
      // Calculate new balance: balance = limit - available
      const newBalance = currentLimit - parseFloat(editAvailableCredit);
      
      await axios.patch(
        `${apiUrl}/api/accounts/${accountId}/balance`,
        { balance: newBalance },
        axiosConfig
      );
      
      setEditingAvailableCredit(null);
      fetchAccounts();
    } catch (error) {
      console.error('Error updating available credit:', error);
      alert('Failed to update available credit');
    }
  };

  const cancelEditAvailableCredit = () => {
    setEditingAvailableCredit(null);
    setEditAvailableCredit('');
  };

  // Delete account
  const deleteAccount = async (accountId, accountName) => {
    if (!window.confirm(`Are you sure you want to delete "${accountName}"?`)) {
      return;
    }
    
    try {
      await axios.delete(`${apiUrl}/api/accounts/${accountId}`, axiosConfig);
      fetchAccounts();
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Failed to delete account');
    }
  };

  const startRename = (account) => {
    setRenamingAccount(account.id);
    setNewName(account.custom_name || account.name);
  };

  const saveRename = async (accountId) => {
    try {
      // Optimistically update UI
      setAccounts(prev => prev.map(acc => 
        acc.id === accountId ? { ...acc, custom_name: newName } : acc
      ));
      setRenamingAccount(null);
      
      // Update backend
      await axios.patch(`${apiUrl}/api/accounts/${accountId}/rename`, { customName: newName }, axiosConfig);
    } catch (error) {
      console.error('Error renaming account:', error);
      // Revert on error
      fetchAccounts();
    }
  };

  const cancelRename = () => {
    setRenamingAccount(null);
    setNewName('');
  };

  const handleDragStart = (e, account, accountType) => {
    setDraggedItem({ account, accountType });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, targetAccount, targetType) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem.accountType !== targetType) {
      setDraggedItem(null);
      return;
    }

    const sourceAccount = draggedItem.account;
    
    // Get all accounts of this type
    const accountsOfType = accounts.filter(a => 
      (targetType === 'bank' && a.type === 'depository') ||
      (targetType === 'credit' && a.type === 'credit')
    ).sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

    const sourceIndex = accountsOfType.findIndex(a => a.id === sourceAccount.id);
    const targetIndex = accountsOfType.findIndex(a => a.id === targetAccount.id);

    if (sourceIndex === targetIndex) {
      setDraggedItem(null);
      return;
    }

    // Reorder
    const reordered = [...accountsOfType];
    const [removed] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, removed);

    // Update display_order
    const updates = reordered.map((acc, idx) => ({
      accountId: acc.id,
      order: idx
    }));

    // Optimistically update UI
    setAccounts(prev => prev.map(acc => {
      const update = updates.find(u => u.accountId === acc.id);
      return update ? { ...acc, display_order: update.order } : acc;
    }));

    // Update backend
    try {
      await axios.patch(`${apiUrl}/api/accounts/reorder`, { accountOrders: updates }, axiosConfig);
    } catch (error) {
      console.error('Error reordering accounts:', error);
      fetchAccounts();
    }

    setDraggedItem(null);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const trueAvailableCash = parseFloat(summary.netAvailableCash) - unpaidBills;

  // Separate and sort accounts (no hidden filter)
  const bankAccounts = accounts
    .filter(a => a.type === 'depository')
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  
  const creditAccounts = accounts
    .filter(a => a.type === 'credit')
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

  const isBalanceStale = (lastUpdated) => {
    if (!lastUpdated) return false;
    const daysSince = (Date.now() - new Date(lastUpdated)) / (1000 * 60 * 60 * 24);
    return daysSince >= 7;
  };

  const renderAccount = (account, accountType) => (
    <div
      key={account.id}
      className={`account-card ${account.type} ${isBalanceStale(account.last_updated) ? 'stale' : ''}`}
      draggable
      onDragStart={(e) => handleDragStart(e, account, accountType)}
      onDragOver={handleDragOver}
      onDrop={(e) => handleDrop(e, account, accountType)}
    >
      <div className="drag-handle">⋮⋮</div>
      <div className="account-header">
        {renamingAccount === account.id ? (
          <div className="rename-input">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <button onClick={() => saveRename(account.id)} className="save-btn">✓</button>
            <button onClick={cancelRename} className="cancel-btn">✕</button>
          </div>
        ) : (
          <h3>{account.custom_name || account.name}</h3>
        )}
      </div>
      
      {account.type === 'credit' ? (
        <>
          {/* Balance Owed - NOT editable */}
          <div className="balance">
            <span className="label">Balance Owed:</span>
            <span className="value">{formatCurrency(account.creditBalance)}</span>
          </div>
          
          {/* Available Credit - EDITABLE */}
          {editingAvailableCredit === account.id ? (
            <div className="edit-balance">
              <label>Available Credit:</label>
              <input
                type="number"
                step="0.01"
                value={editAvailableCredit}
                onChange={(e) => setEditAvailableCredit(e.target.value)}
                autoFocus
              />
              <button onClick={() => saveAvailableCredit(account.id, account.limit)} className="save-btn">✓</button>
              <button onClick={cancelEditAvailableCredit} className="cancel-btn">✕</button>
            </div>
          ) : (
            <div className="balance secondary" onClick={() => startEditAvailableCredit(account)}>
              <span className="label">Available Credit:</span>
              <span className="value clickable">{formatCurrency(account.availableCredit)}</span>
            </div>
          )}
          
          {/* Credit Limit - EDITABLE */}
          {editingCreditLimit === account.id ? (
            <div className="edit-balance">
              <label>Credit Limit:</label>
              <input
                type="number"
                step="0.01"
                value={editCreditLimit}
                onChange={(e) => setEditCreditLimit(e.target.value)}
                autoFocus
              />
              <button onClick={() => saveCreditLimit(account.id)} className="save-btn">✓</button>
              <button onClick={cancelEditCreditLimit} className="cancel-btn">✕</button>
            </div>
          ) : (
            <div className="balance secondary" onClick={() => startEditCreditLimit(account)}>
              <span className="label">Credit Limit:</span>
              <span className="value clickable">{formatCurrency(account.limit)}</span>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Bank Account Balance - EDITABLE */}
          {editingBalance === account.id ? (
            <div className="edit-balance">
              <label>Available:</label>
              <input
                type="number"
                step="0.01"
                value={editBalance}
                onChange={(e) => setEditBalance(e.target.value)}
                autoFocus
              />
              <button onClick={() => saveBalance(account.id)} className="save-btn">✓</button>
              <button onClick={cancelEditBalance} className="cancel-btn">✕</button>
            </div>
          ) : (
            <div className="balance" onClick={() => startEditBalance(account)}>
              <span className="label">Available:</span>
              <span className="value clickable">{formatCurrency(account.balance)}</span>
            </div>
          )}
        </>
      )}
      
      {account.last_updated && (
        <p className={`last-updated ${isBalanceStale(account.last_updated) ? 'stale' : ''}`}>
          Updated: {new Date(account.last_updated).toLocaleDateString()}
          {isBalanceStale(account.last_updated) && ' ⚠️'}
        </p>
      )}
      
      <div className="account-actions">
        <button onClick={() => startRename(account)} className="action-btn" title="Rename">
          ✏️ Rename
        </button>
        <button onClick={() => deleteAccount(account.id, account.custom_name || account.name)} className="action-btn delete" title="Delete">
          🗑️ Delete
        </button>
      </div>
    </div>
  );

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Cash Flow Tracker</h1>
          <p>Welcome, {user?.name || user?.email}</p>
        </div>
        <button onClick={onLogout} className="logout-btn">
          Logout
        </button>
      </header>

      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'accounts' ? 'active' : ''}`}
          onClick={() => setActiveTab('accounts')}
        >
          Accounts
        </button>
        <button 
          className={`tab ${activeTab === 'bills' ? 'active' : ''}`}
          onClick={() => setActiveTab('bills')}
        >
          Bills
        </button>
      </div>

      {activeTab === 'accounts' && (
        <>
          <div className="summary-container">
            <div className="summary-card total">
              <h2>True Available Cash</h2>
              <div className="amount">
                {formatCurrency(trueAvailableCash)}
              </div>
              <p className="formula">Bank - Credit Cards - Unpaid Bills</p>
            </div>

            <div className="summary-card bank">
              <h3>Total Bank Balance</h3>
              <div className="amount">{formatCurrency(summary.totalBankBalance)}</div>
            </div>

            <div className="summary-card credit">
              <h3>Total Credit Balance Owed</h3>
              <div className="amount">{formatCurrency(summary.totalCreditBalance)}</div>
            </div>

            <div className="summary-card bills">
              <h3>Unpaid Bills</h3>
              <div className="amount">{formatCurrency(unpaidBills)}</div>
            </div>
          </div>

          <div className="actions">
            <button onClick={() => setShowAddForm(!showAddForm)} className="add-account-btn">
              {showAddForm ? '✕ Cancel' : '+ Add Account'}
            </button>
          </div>

          {showAddForm && (
            <div className="add-account-form">
              <h3>Add New Account</h3>
              <form onSubmit={handleCreateAccount}>
                <div className="form-group">
                  <label>Account Name:</label>
                  <input
                    type="text"
                    value={newAccount.name}
                    onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                    placeholder="e.g., Chase Checking"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Account Type:</label>
                  <select
                    value={newAccount.type}
                    onChange={(e) => setNewAccount({ ...newAccount, type: e.target.value })}
                  >
                    <option value="depository">Bank Account (Checking/Savings)</option>
                    <option value="credit">Credit Card</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label>
                    {newAccount.type === 'credit' ? 'Current Balance Owed:' : 'Current Balance:'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newAccount.balance}
                    onChange={(e) => setNewAccount({ ...newAccount, balance: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>
                
                {newAccount.type === 'credit' && (
                  <div className="form-group">
                    <label>Credit Limit:</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newAccount.credit_limit}
                      onChange={(e) => setNewAccount({ ...newAccount, credit_limit: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                )}
                
                <button type="submit" className="submit-btn">Create Account</button>
              </form>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <div className="accounts-section">
            <h2>Bank Accounts</h2>
            {bankAccounts.length === 0 ? (
              <div className="empty-state">
                <p>No bank accounts added. Click "+ Add Account" to get started.</p>
              </div>
            ) : (
              <div className="accounts-grid">
                {bankAccounts.map(account => renderAccount(account, 'bank'))}
              </div>
            )}
          </div>

          <div className="accounts-section">
            <h2>Credit Cards</h2>
            {creditAccounts.length === 0 ? (
              <div className="empty-state">
                <p>No credit cards added.</p>
              </div>
            ) : (
              <div className="accounts-grid">
                {creditAccounts.map(account => renderAccount(account, 'credit'))}
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'bills' && (
        <Bills token={token} apiUrl={apiUrl} />
      )}
    </div>
  );
}

export default Dashboard;
