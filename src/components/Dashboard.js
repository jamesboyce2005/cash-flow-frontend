import React, { useState, useEffect, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import axios from 'axios';
import Bills from './Bills';
import './Dashboard.css';

function Dashboard({ user, token, onLogout, apiUrl }) {
  const [activeTab, setActiveTab] = useState('accounts');
  const [accounts, setAccounts] = useState([]);
  const [loans, setLoans] = useState([]);
  const [summary, setSummary] = useState({
    totalBankBalance: '0.00',
    totalCreditBalance: '0.00',
    netAvailableCash: '0.00',
  });
  const [unpaidBills, setUnpaidBills] = useState(0);
  const [linkToken, setLinkToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [showTransactions, setShowTransactions] = useState(false);
  const [renamingAccount, setRenamingAccount] = useState(null);
  const [newName, setNewName] = useState('');
  const [draggedItem, setDraggedItem] = useState(null);

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

  // Fetch cached accounts (fast, no Plaid call)
  const fetchCachedAccounts = useCallback(async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/accounts/cached`, axiosConfig);
      
      // Separate by type
      const regularAccounts = [];
      const loanAccounts = [];
      
      response.data.accounts.forEach(account => {
        if (account.type === 'loan') {
          loanAccounts.push(account);
        } else {
          regularAccounts.push(account);
        }
      });
      
      setAccounts(regularAccounts);
      setLoans(loanAccounts);
      setSummary(response.data.summary);
      
      await fetchUnpaidBills();
    } catch (err) {
      console.error('Error fetching cached accounts:', err);
    }
  }, [apiUrl, token]);
  
  // Fetch accounts
  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${apiUrl}/api/accounts`, axiosConfig);
      
      // Separate by type
      const regularAccounts = [];
      const loanAccounts = [];
      
      response.data.accounts.forEach(account => {
        if (account.type === 'loan') {
          loanAccounts.push(account);
        } else {
          regularAccounts.push(account);
        }
      });
      
      setAccounts(regularAccounts);
      setLoans(loanAccounts);
      setSummary(response.data.summary);
      
      await fetchUnpaidBills();
    } catch (err) {
      setError('Failed to fetch accounts');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, token]);

// Refresh single account
  const refreshSingleAccount = async (accountId) => {
    try {
      const response = await axios.get(`${apiUrl}/api/accounts/${accountId}/refresh`, axiosConfig);
      
      // Update just this account in state
      setAccounts(prev => prev.map(acc => 
        acc.id === accountId ? response.data.account : acc
      ));
      
      setLoans(prev => prev.map(loan => 
        loan.id === accountId ? response.data.account : loan
      ));
      
      // Recalculate summary
      await fetchCachedAccounts();
    } catch (error) {
      console.error('Error refreshing account:', error);
    }
  };
  
  const getLinkToken = async () => {
    try {
      const response = await axios.post(
        `${apiUrl}/api/plaid/create-link-token`,
        {},
        axiosConfig
      );
      setLinkToken(response.data.link_token);
    } catch (err) {
      console.error('Error getting link token:', err);
    }
  };

  const onSuccess = useCallback(async (publicToken) => {
    try {
      await axios.post(
        `${apiUrl}/api/plaid/exchange-public-token`,
        { public_token: publicToken },
        axiosConfig
      );
      fetchAccounts();
    } catch (err) {
      setError('Failed to link account');
      console.error(err);
    }
  }, [apiUrl, token, fetchAccounts]);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
  });

useEffect(() => {
    fetchCachedAccounts(); // Load cached first (instant)
    getLinkToken();
  }, [fetchCachedAccounts]);

  const handleAddAccount = () => {
    if (ready) {
      open();
    } else {
      getLinkToken();
    }
  };

  const toggleHideAccount = async (accountId) => {
    try {
      // Optimistically update UI
      setAccounts(prev => prev.map(acc => 
        acc.id === accountId ? { ...acc, hidden: !acc.hidden } : acc
      ));
      
      // Update backend
      await axios.patch(`${apiUrl}/api/accounts/${accountId}/toggle-hide`, {}, axiosConfig);
    } catch (error) {
      console.error('Error hiding account:', error);
      // Revert on error
      fetchAccounts();
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

  const viewTransactions = async (account) => {
    setSelectedAccount(account);
    setShowTransactions(true);
    try {
      const response = await axios.get(`${apiUrl}/api/accounts/${account.id}/transactions`, axiosConfig);
      setTransactions(response.data.transactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setTransactions([]);
    }
  };

  const closeTransactions = () => {
    setShowTransactions(false);
    setSelectedAccount(null);
    setTransactions([]);
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

  // Separate and sort accounts
  const bankAccounts = accounts
    .filter(a => a.type === 'depository' && !a.hidden)
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  
  const creditAccounts = accounts
    .filter(a => a.type === 'credit' && !a.hidden)
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

  const renderAccount = (account, accountType) => (
    <div
      key={account.id}
      className={`account-card ${account.type}`}
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
          <>
            <h3>{account.custom_name || account.name}</h3>
            <span className="account-type">{account.subtype}</span>
          </>
        )}
      </div>
      {account.mask && (
        <p className="account-mask">••••{account.mask}</p>
      )}
      {account.type === 'credit' ? (
        <>
          <div className="balance">
            <span className="label">Balance Owed:</span>
            <span className="value">{formatCurrency(account.creditBalance)}</span>
          </div>
          <div className="balance secondary">
            <span className="label">Available Credit:</span>
            <span className="value">{formatCurrency(account.availableCredit)}</span>
          </div>
          {account.limit && (
            <div className="balance secondary">
              <span className="label">Credit Limit:</span>
              <span className="value">{formatCurrency(account.limit)}</span>
            </div>
          )}
        </>
      ) : (
        <div className="balance">
          <span className="label">Available:</span>
          <span className="value">{formatCurrency(account.balance)}</span>
        </div>
      )}
     {account.last_updated && (
        <p className="last-updated">
          Updated: {new Date(account.last_updated).toLocaleString()}
        </p>
      )}
      <div className="account-actions">
        <button onClick={() => refreshSingleAccount(account.id)} className="action-btn" title="Refresh">
          🔄
        </button>
        <button onClick={() => viewTransactions(account)} className="action-btn" title="Transactions">
          📋
        </button>
        <button onClick={() => startRename(account)} className="action-btn" title="Rename">
          ✏️
        </button>
        <button onClick={() => toggleHideAccount(account.id)} className="action-btn" title="Hide">
          👁️
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
        <button 
          className={`tab ${activeTab === 'loans' ? 'active' : ''}`}
          onClick={() => setActiveTab('loans')}
        >
          Loans
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
            <button onClick={handleAddAccount} className="add-account-btn" disabled={!ready}>
              + Add Bank Account
            </button>
            <button onClick={fetchAccounts} className="refresh-btn" disabled={loading}>
              {loading ? 'Refreshing...' : '🔄 Refresh Balances'}
            </button>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="accounts-section">
            <h2>Bank Accounts</h2>
            {bankAccounts.length === 0 ? (
              <div className="empty-state">
                <p>No bank accounts connected.</p>
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
                <p>No credit cards connected.</p>
              </div>
            ) : (
              <div className="accounts-grid">
                {creditAccounts.map(account => renderAccount(account, 'credit'))}
              </div>
            )}
          </div>

          {accounts.filter(a => a.hidden).length > 0 && (
            <div className="hidden-accounts">
              <h3>Hidden Accounts</h3>
              {accounts.filter(a => a.hidden).map((account) => (
                <div key={account.id} className="hidden-account-item">
                  <span>{account.custom_name || account.name}</span>
                  <button onClick={() => toggleHideAccount(account.id)} className="unhide-btn">
                    Show
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'bills' && (
        <Bills token={token} apiUrl={apiUrl} />
      )}

      {activeTab === 'loans' && (
        <div className="accounts-section loans-section">
          <h2>Your Loans</h2>
          {loans.length === 0 ? (
            <p className="empty-state">No loans connected.</p>
          ) : (
            <div className="accounts-grid">
              {loans.map((loan) => (
                <div key={loan.id} className="account-card loan">
                  <div className="account-header">
                    <h3>{loan.custom_name || loan.name}</h3>
                    <span className="account-type">{loan.subtype || 'loan'}</span>
                  </div>
                  {loan.mask && (
                    <p className="account-mask">••••{loan.mask}</p>
                  )}
                  <div className="balance">
                    <span className="label">Current Balance:</span>
                    <span className="value">{formatCurrency(loan.balance || loan.current)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showTransactions && (
        <div className="modal-overlay" onClick={closeTransactions}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Transactions: {selectedAccount?.custom_name || selectedAccount?.name}</h2>
              <button onClick={closeTransactions} className="close-btn">✕</button>
            </div>
            <div className="transactions-list">
              {transactions.length === 0 ? (
                <p>No recent transactions.</p>
              ) : (
                transactions.map((txn) => (
                  <div key={txn.transaction_id} className="transaction-item">
                    <div className="txn-info">
                      <strong>{txn.name}</strong>
                      <p>{new Date(txn.date).toLocaleDateString()}</p>
                    </div>
                    <div className={`txn-amount ${txn.amount > 0 ? 'debit' : 'credit'}`}>
                      {formatCurrency(Math.abs(txn.amount))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
