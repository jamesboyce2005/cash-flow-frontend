import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../db';
import SummaryScreen from './SummaryScreen';
import Bills from './Bills';
import BudgetGrid from './BudgetGrid';
import ReservesGrid from './ReservesGrid';
import IncomeTracker from './IncomeTracker';
import './Dashboard.css';

function Dashboard() {
  const [activeTab, setActiveTab] = useState('summary');
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

  // Bumped whenever accounts/bills/reserves/income change, so the Summary tab refetches
  const [summaryRefreshKey, setSummaryRefreshKey] = useState(0);
  const bumpSummary = () => setSummaryRefreshKey(k => k + 1);

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

  // Expandable sections
  const [showBankAccounts, setShowBankAccounts] = useState(false);
  const [showCreditAccounts, setShowCreditAccounts] = useState(false);

  // Options menu (Export/Import tucked away)
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);

  // Initialize database
  useEffect(() => {
    const initDB = async () => {
      try {
        await db.init();
        await db.autoGenerateBills(); // creates this month's recurring bills from Budget, once per month
        fetchAccounts();
      } catch (error) {
        console.error('Failed to initialize database:', error);
        setError('Failed to initialize database');
      }
    };
    initDB();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-sync whenever the person switches back to the Accounts tab
  useEffect(() => {
    if (activeTab === 'accounts') {
      fetchUnpaidBills();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Fetch unpaid bills (current month + anything unpaid carried forward)
  const fetchUnpaidBills = async () => {
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const allBills = await db.getAllBills();
      const isBeforeCurrentMonth = (b) =>
        b.year < year || (b.year === year && b.month < month);

      const relevant = allBills.filter(b =>
        (b.month === month && b.year === year) ||
        (!b.is_paid && isBeforeCurrentMonth(b))
      );

      const unpaid = relevant
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
      const accountsData = await db.getAccounts();

      let totalBankBalance = 0;
      let totalCreditBalance = 0;

      const processedAccounts = accountsData.map(acc => {
        const account = {
          id: acc.id,
          name: acc.name,
          type: acc.type,
          balance: parseFloat(acc.last_balance) || 0,
          custom_name: acc.custom_name,
          display_order: acc.display_order,
          last_updated: acc.last_updated,
        };

        if (acc.type === 'credit') {
          const creditLimit = parseFloat(acc.credit_limit) || 0;
          const balance = parseFloat(acc.last_balance) || 0;

          account.limit = creditLimit;
          account.creditBalance = balance;
          account.availableCredit = creditLimit - balance;
          totalCreditBalance += balance;
        } else {
          totalBankBalance += parseFloat(acc.last_balance) || 0;
        }

        return account;
      });

      setAccounts(processedAccounts);
      setSummary({
        totalBankBalance: totalBankBalance.toFixed(2),
        totalCreditBalance: totalCreditBalance.toFixed(2),
        netAvailableCash: (totalBankBalance - totalCreditBalance).toFixed(2),
      });

      await fetchUnpaidBills();
      bumpSummary();
    } catch (err) {
      setError('Failed to fetch accounts');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Create new account
  const handleCreateAccount = async (e) => {
    e.preventDefault();

    if (!newAccount.name || !newAccount.balance) {
      alert('Please fill in account name and balance');
      return;
    }

    try {
      await db.addAccount({
        name: newAccount.name,
        type: newAccount.type,
        last_balance: parseFloat(newAccount.balance),
        credit_limit: newAccount.type === 'credit' ? parseFloat(newAccount.credit_limit || 0) : null
      });

      setNewAccount({ name: '', type: 'depository', balance: '', credit_limit: '' });
      setShowAddForm(false);
      fetchAccounts();
    } catch (error) {
      console.error('Error creating account:', error);
      alert('Failed to create account');
    }
  };

  const startEditBalance = (account) => {
    setEditingBalance(account.id);
    setEditBalance(account.balance.toString());
  };

  const saveBalance = async (accountId) => {
    try {
      await db.updateAccount(accountId, {
        last_balance: parseFloat(editBalance)
      });

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

  const startEditCreditLimit = (account) => {
    setEditingCreditLimit(account.id);
    setEditCreditLimit(account.limit.toString());
  };

  const saveCreditLimit = async (accountId) => {
    try {
      await db.updateAccount(accountId, {
        credit_limit: parseFloat(editCreditLimit)
      });

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

  const startEditAvailableCredit = (account) => {
    setEditingAvailableCredit(account.id);
    setEditAvailableCredit(account.availableCredit.toString());
  };

  const saveAvailableCredit = async (accountId, currentLimit) => {
    try {
      const newBalance = currentLimit - parseFloat(editAvailableCredit);

      await db.updateAccount(accountId, {
        last_balance: newBalance
      });

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

  const deleteAccount = async (accountId, accountName) => {
    if (!window.confirm(`Are you sure you want to delete "${accountName}"?`)) {
      return;
    }

    try {
      await db.deleteAccount(accountId);
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
      await db.updateAccount(accountId, {
        custom_name: newName
      });

      setRenamingAccount(null);
      fetchAccounts();
    } catch (error) {
      console.error('Error renaming account:', error);
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

    const reordered = [...accountsOfType];
    const [removed] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, removed);

    const updates = reordered.map((acc, idx) => ({
      accountId: acc.id,
      order: idx
    }));

    try {
      await db.updateAccountOrder(updates);
      fetchAccounts();
    } catch (error) {
      console.error('Error reordering accounts:', error);
      fetchAccounts();
    }

    setDraggedItem(null);
  };

  const handleExport = async () => {
    try {
      const data = await db.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cashflow-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Failed to export data');
    }
    setShowOptionsMenu(false);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    setShowOptionsMenu(false);
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);

        if (!window.confirm('This will replace ALL your current data. Are you sure?')) {
          return;
        }

        await db.importData(data);
        fetchAccounts();
        alert('Data imported successfully!');
      } catch (error) {
        console.error('Error importing data:', error);
        alert('Failed to import data. Make sure the file is valid.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const trueAvailableCash = parseFloat(summary.netAvailableCash) - unpaidBills;

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
          <div className="balance">
            <span className="label">Balance Owed:</span>
            <span className="value">{formatCurrency(account.creditBalance)}</span>
          </div>

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
        </div>
        <div className="header-actions">
          <button
            className="options-btn"
            onClick={() => setShowOptionsMenu(!showOptionsMenu)}
            title="Options"
          >
            ⋯
          </button>
          {showOptionsMenu && (
            <div className="options-menu">
              <button onClick={handleExport} className="options-menu-item">
                📥 Export Data
              </button>
              <label className="options-menu-item options-menu-import">
                📤 Import Data
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          )}
        </div>
      </header>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveTab('summary')}
        >
          Summary
        </button>
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
        <button
          className={`tab ${activeTab === 'budget' ? 'active' : ''}`}
          onClick={() => setActiveTab('budget')}
        >
          Budget
        </button>
        <button
          className={`tab ${activeTab === 'reserves' ? 'active' : ''}`}
          onClick={() => setActiveTab('reserves')}
        >
          Reserves
        </button>
        <button
          className={`tab ${activeTab === 'income' ? 'active' : ''}`}
          onClick={() => setActiveTab('income')}
        >
          Income
        </button>
      </div>

      {activeTab === 'summary' && (
        <SummaryScreen refreshKey={summaryRefreshKey} />
      )}

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

            <div className="summary-card bank" onClick={() => setShowBankAccounts(!showBankAccounts)}>
              <h3>Total Bank Balance {showBankAccounts ? '▼' : '▶'}</h3>
              <div className="amount">{formatCurrency(summary.totalBankBalance)}</div>
            </div>

            {showBankAccounts && (
              <div className="inline-accounts-expansion">
                {bankAccounts.length === 0 ? (
                  <div className="empty-state small">No bank accounts added yet.</div>
                ) : (
                  <div className="accounts-grid">
                    {bankAccounts.map(account => renderAccount(account, 'bank'))}
                  </div>
                )}
              </div>
            )}

            <div className="summary-card credit" onClick={() => setShowCreditAccounts(!showCreditAccounts)}>
              <h3>Total Credit Balance Owed {showCreditAccounts ? '▼' : '▶'}</h3>
              <div className="amount">{formatCurrency(summary.totalCreditBalance)}</div>
            </div>

            {showCreditAccounts && (
              <div className="inline-accounts-expansion">
                {creditAccounts.length === 0 ? (
                  <div className="empty-state small">No credit cards added yet.</div>
                ) : (
                  <div className="accounts-grid">
                    {creditAccounts.map(account => renderAccount(account, 'credit'))}
                  </div>
                )}
              </div>
            )}

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
        </>
      )}

      {activeTab === 'bills' && (
        <Bills onBillsChange={() => { fetchUnpaidBills(); bumpSummary(); }} />
      )}

      {activeTab === 'budget' && (
        <BudgetGrid />
      )}

      {activeTab === 'reserves' && (
        <ReservesGrid onReservesChange={bumpSummary} />
      )}

      {activeTab === 'income' && (
        <IncomeTracker onIncomeChange={bumpSummary} />
      )}
    </div>
  );
}

export default Dashboard;
