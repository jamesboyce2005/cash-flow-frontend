import React, { useState, useEffect, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import axios from 'axios';
import './Dashboard.css';

function Dashboard({ user, token, onLogout, apiUrl }) {
  const [accounts, setAccounts] = useState([]);
  const [summary, setSummary] = useState({
    totalBankBalance: '0.00',
    totalCreditBalance: '0.00',
    netAvailableCash: '0.00',
  });
  const [linkToken, setLinkToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const axiosConfig = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  // Fetch accounts
  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${apiUrl}/api/accounts`, axiosConfig);
      setAccounts(response.data.accounts);
      setSummary(response.data.summary);
    } catch (err) {
      setError('Failed to fetch accounts');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, token]);

  // Get link token for Plaid
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

  // Handle successful Plaid link
  const onSuccess = useCallback(async (publicToken) => {
    try {
      await axios.post(
        `${apiUrl}/api/plaid/exchange-public-token`,
        { public_token: publicToken },
        axiosConfig
      );
      // Refresh accounts after linking
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
    fetchAccounts();
    getLinkToken();
  }, [fetchAccounts]);

  const handleAddAccount = () => {
    if (ready) {
      open();
    } else {
      getLinkToken();
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

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

      <div className="summary-container">
        <div className="summary-card total">
          <h2>Net Available Cash</h2>
          <div className="amount">
            {formatCurrency(summary.netAvailableCash)}
          </div>
          <p className="formula">Bank Balances - Credit Card Balances</p>
        </div>

        <div className="summary-card bank">
          <h3>Total Bank Balance</h3>
          <div className="amount">{formatCurrency(summary.totalBankBalance)}</div>
        </div>

        <div className="summary-card credit">
          <h3>Total Credit Balance Owed</h3>
          <div className="amount">{formatCurrency(summary.totalCreditBalance)}</div>
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
        <h2>Your Accounts</h2>
        {accounts.length === 0 ? (
          <div className="empty-state">
            <p>No accounts linked yet.</p>
            <p>Click "Add Bank Account" to get started!</p>
          </div>
        ) : (
          <div className="accounts-grid">
            {accounts.map((account) => (
              <div key={account.id} className={`account-card ${account.type}`}>
                <div className="account-header">
                  <h3>{account.name}</h3>
                  <span className="account-type">{account.subtype}</span>
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
