import React, { useState, useEffect } from 'react';
import { db } from '../db';
import './SummaryScreen.css';

function SummaryScreen({ refreshKey }) {
  const [bankAccounts, setBankAccounts] = useState([]);
  const [creditAccounts, setCreditAccounts] = useState([]);
  const [bills, setBills] = useState([]);
  const [reserves, setReserves] = useState([]);
  const [income, setIncome] = useState([]);
  const [expanded, setExpanded] = useState({
    bank: false,
    credit: false,
    bills: false,
    reserves: false,
    income: false
  });

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const fetchAll = async () => {
    try {
      const accountsData = await db.getAccounts();
      const bank = [];
      const credit = [];

      accountsData.forEach(acc => {
        if (acc.type === 'credit') {
          credit.push({
            id: acc.id,
            name: acc.custom_name || acc.name,
            balance: parseFloat(acc.last_balance) || 0
          });
        } else {
          bank.push({
            id: acc.id,
            name: acc.custom_name || acc.name,
            balance: parseFloat(acc.last_balance) || 0
          });
        }
      });

      setBankAccounts(bank);
      setCreditAccounts(credit);

      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const allBills = await db.getAllBills();
      const isBeforeCurrentMonth = (b) => b.year < year || (b.year === year && b.month < month);
      const relevantUnpaid = allBills.filter(b =>
        !b.is_paid && ((b.month === month && b.year === year) || isBeforeCurrentMonth(b))
      );
      setBills(relevantUnpaid);

      const reservesData = await db.getReserves();
      setReserves(reservesData);

      const incomeData = await db.getIncome();
      setIncome(incomeData.filter(e => !e.received));
    } catch (error) {
      console.error('Error loading summary:', error);
    }
  };

  const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const totalBank = bankAccounts.reduce((s, a) => s + a.balance, 0);
  const totalCredit = creditAccounts.reduce((s, a) => s + a.balance, 0);
  const totalBills = bills.reduce((s, b) => s + parseFloat(b.amount), 0);
  const totalReserves = reserves.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const totalIncome = income.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

  const availableCash = totalBank - totalCredit - totalBills - totalReserves + totalIncome;

  const Row = ({ rowKey, label, total, sign, items, renderItem, emptyLabel }) => (
    <div className="breakdown-row">
      <button className="breakdown-header" onClick={() => toggle(rowKey)}>
        <span className="row-label">
          <span className="chevron">{expanded[rowKey] ? '▼' : '▶'}</span> {label}
        </span>
        <span className={`row-value ${sign}`}>
          {sign === 'negative' ? '− ' : sign === 'positive-add' ? '+ ' : ''}
          {formatCurrency(total)}
        </span>
      </button>
      {expanded[rowKey] && (
        <div className="breakdown-details">
          {items.length === 0 ? (
            <p className="detail-empty">{emptyLabel}</p>
          ) : (
            items.map(renderItem)
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="summary-screen">
      <div className="available-cash-card">
        <h2>Available Cash</h2>
        <div className="amount">{formatCurrency(availableCash)}</div>
        <p className="formula">Bank − Credit Cards − Unpaid Bills − Reserves + Expected Income</p>
      </div>

      <div className="breakdown-list">
        <Row
          rowKey="bank"
          label="Bank Accounts"
          total={totalBank}
          sign="positive"
          items={bankAccounts}
          emptyLabel="No bank accounts"
          renderItem={(a) => (
            <div key={a.id} className="detail-item">
              <span>{a.name}</span>
              <span>{formatCurrency(a.balance)}</span>
            </div>
          )}
        />

        <Row
          rowKey="credit"
          label="Credit Cards"
          total={totalCredit}
          sign="negative"
          items={creditAccounts}
          emptyLabel="No credit cards"
          renderItem={(a) => (
            <div key={a.id} className="detail-item">
              <span>{a.name}</span>
              <span>{formatCurrency(a.balance)}</span>
            </div>
          )}
        />

        <Row
          rowKey="bills"
          label="Unpaid Bills"
          total={totalBills}
          sign="negative"
          items={bills}
          emptyLabel="No unpaid bills"
          renderItem={(b) => (
            <div key={b.id} className="detail-item">
              <span>{b.name}</span>
              <span>{formatCurrency(b.amount)}</span>
            </div>
          )}
        />

        <Row
          rowKey="reserves"
          label="Reserves"
          total={totalReserves}
          sign="negative"
          items={reserves}
          emptyLabel="No reserves set aside"
          renderItem={(r) => (
            <div key={r.id} className="detail-item">
              <span>{r.name}</span>
              <span>{formatCurrency(r.amount)}</span>
            </div>
          )}
        />

        <Row
          rowKey="income"
          label="Expected Income"
          total={totalIncome}
          sign="positive-add"
          items={income}
          emptyLabel="Nothing expected"
          renderItem={(e) => (
            <div key={e.id} className="detail-item">
              <span>{e.name}</span>
              <span>{formatCurrency(e.amount)}</span>
            </div>
          )}
        />
      </div>
    </div>
  );
}

export default SummaryScreen;
