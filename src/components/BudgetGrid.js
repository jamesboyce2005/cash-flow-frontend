import React, { useState, useEffect } from 'react';
import { db } from '../db';
import './BudgetGrid.css';

function BudgetGrid() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-12
  
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [categories, setCategories] = useState([]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCell, setEditingCell] = useState(null); // {category, month}
  const [editValue, setEditValue] = useState('');

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const years = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  useEffect(() => {
    fetchBudget();
  }, [selectedYear]);

  const fetchBudget = async () => {
    try {
      const budgetData = await db.getBudgetForYear(selectedYear);
      setCategories(budgetData);
    } catch (error) {
      console.error('Error fetching budget:', error);
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    
    if (!newCategoryName.trim()) {
      alert('Please enter a category name');
      return;
    }

    // Check if category already exists
    if (categories.find(c => c.category === newCategoryName)) {
      alert('Category already exists');
      return;
    }

    try {
      // Create empty amounts for all 12 months
      const amounts = {};
      for (let i = 1; i <= 12; i++) {
        amounts[i] = 0;
      }

      await db.saveBudgetCategory(selectedYear, newCategoryName, amounts);
      setNewCategoryName('');
      setShowAddCategory(false);
      fetchBudget();
    } catch (error) {
      console.error('Error adding category:', error);
      alert('Failed to add category');
    }
  };

  const handleDeleteCategory = async (category) => {
    if (!window.confirm(`Delete "${category}" from ${selectedYear} budget?`)) {
      return;
    }

    try {
      await db.deleteBudgetCategory(selectedYear, category);
      fetchBudget();
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Failed to delete category');
    }
  };

  const startEdit = (category, month) => {
    const categoryData = categories.find(c => c.category === category);
    const currentValue = categoryData?.amounts?.[month] || 0;
    
    setEditingCell({ category, month });
    setEditValue(currentValue.toString());
  };

  const saveEdit = async () => {
    if (!editingCell) return;

    const { category, month } = editingCell;
    const categoryData = categories.find(c => c.category === category);
    
    if (!categoryData) return;

    try {
      const updatedAmounts = {
        ...categoryData.amounts,
        [month]: parseFloat(editValue) || 0
      };

      await db.saveBudgetCategory(selectedYear, category, updatedAmounts);
      setEditingCell(null);
      fetchBudget();
    } catch (error) {
      console.error('Error saving amount:', error);
      alert('Failed to save amount');
    }
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  const exportToCSV = () => {
    // Create CSV header
    let csv = `Category,${months.join(',')},Total\n`;

    // Add data rows
    categories.forEach(cat => {
      const amounts = months.map((_, idx) => {
        const month = idx + 1;
        return cat.amounts?.[month] || 0;
      });
      const total = amounts.reduce((sum, amt) => sum + amt, 0);
      csv += `${cat.category},${amounts.join(',')},${total}\n`;
    });

    // Add totals row
    const monthlyTotals = months.map((_, idx) => {
      const month = idx + 1;
      return categories.reduce((sum, cat) => sum + (cat.amounts?.[month] || 0), 0);
    });
    const grandTotal = monthlyTotals.reduce((sum, amt) => sum + amt, 0);
    csv += `TOTAL,${monthlyTotals.join(',')},${grandTotal}\n`;

    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `budget-${selectedYear}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getMonthTotal = (month) => {
    return categories.reduce((sum, cat) => sum + (cat.amounts?.[month] || 0), 0);
  };

  const getCategoryTotal = (category) => {
    const categoryData = categories.find(c => c.category === category);
    if (!categoryData) return 0;
    
    let total = 0;
    for (let month = 1; month <= 12; month++) {
      total += categoryData.amounts?.[month] || 0;
    }
    return total;
  };

  const getGrandTotal = () => {
    return categories.reduce((sum, cat) => sum + getCategoryTotal(cat.category), 0);
  };

  return (
    <div className="budget-grid-container">
      <div className="budget-header">
        <div className="year-selector">
          <label>Year:</label>
          <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}>
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        <div className="budget-actions">
          <button onClick={() => setShowAddCategory(!showAddCategory)} className="add-category-btn">
            {showAddCategory ? '✕ Cancel' : '+ Add Category'}
          </button>
          <button onClick={exportToCSV} className="export-csv-btn">
            📊 Export CSV
          </button>
        </div>
      </div>

      {showAddCategory && (
        <div className="add-category-form">
          <form onSubmit={handleAddCategory}>
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Category name (e.g., Rent, Electric)"
              autoFocus
            />
            <button type="submit" className="save-btn">Add</button>
            <button type="button" onClick={() => { setShowAddCategory(false); setNewCategoryName(''); }} className="cancel-btn">Cancel</button>
          </form>
        </div>
      )}

      <div className="grid-wrapper">
        <table className="budget-grid">
          <thead>
            <tr>
              <th className="category-header">Category</th>
              {months.map((month, idx) => (
                <th 
                  key={month} 
                  className={`month-header ${selectedYear === currentYear && idx + 1 === currentMonth ? 'current-month' : ''}`}
                >
                  {month}
                </th>
              ))}
              <th className="total-header">Total</th>
              <th className="actions-header"></th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 ? (
              <tr>
                <td colSpan={15} className="empty-state">
                  No categories yet. Click "+ Add Category" to get started.
                </td>
              </tr>
            ) : (
              <>
                {categories.map((cat) => (
                  <tr key={cat.category}>
                    <td className="category-cell">{cat.category}</td>
                    {months.map((_, idx) => {
                      const month = idx + 1;
                      const amount = cat.amounts?.[month] || 0;
                      const isEditing = editingCell?.category === cat.category && editingCell?.month === month;
                      const isCurrentMonth = selectedYear === currentYear && month === currentMonth;

                      return (
                        <td 
                          key={month} 
                          className={`amount-cell ${isCurrentMonth ? 'current-month' : ''}`}
                          onClick={() => !isEditing && startEdit(cat.category, month)}
                        >
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.01"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={saveEdit}
                              onKeyDown={handleKeyDown}
                              autoFocus
                              className="amount-input"
                            />
                          ) : (
                            <span className="amount-display">
                              {amount > 0 ? formatCurrency(amount) : '-'}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="total-cell">{formatCurrency(getCategoryTotal(cat.category))}</td>
                    <td className="actions-cell">
                      <button 
                        onClick={() => handleDeleteCategory(cat.category)} 
                        className="delete-category-btn"
                        title="Delete Category"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
                <tr className="totals-row">
                  <td className="category-cell"><strong>TOTAL</strong></td>
                  {months.map((_, idx) => {
                    const month = idx + 1;
                    const isCurrentMonth = selectedYear === currentYear && month === currentMonth;
                    return (
                      <td key={month} className={`total-cell ${isCurrentMonth ? 'current-month' : ''}`}>
                        <strong>{formatCurrency(getMonthTotal(month))}</strong>
                      </td>
                    );
                  })}
                  <td className="total-cell grand-total">
                    <strong>{formatCurrency(getGrandTotal())}</strong>
                  </td>
                  <td className="actions-cell"></td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      <div className="budget-info">
        <p>💡 <strong>Tip:</strong> This is a planning tool. Click any cell to enter your expected amount for that month.</p>
        <p>📊 Use "Export CSV" to open in Excel or Google Sheets.</p>
      </div>
    </div>
  );
}

export default BudgetGrid;
