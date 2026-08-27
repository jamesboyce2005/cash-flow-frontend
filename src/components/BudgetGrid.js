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
  const [draggedCategory, setDraggedCategory] = useState(null);
  const [dragOverCategory, setDragOverCategory] = useState(null);
  const [zoom, setZoom] = useState(100); // percent

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthsFull = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const years = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  useEffect(() => {
    fetchBudget();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    if (categories.find(c => c.category === newCategoryName)) {
      alert('Category already exists');
      return;
    }

    try {
      await db.addBudgetCategory(selectedYear, newCategoryName);
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

  const handleToggleRecurring = async (category) => {
    try {
      await db.toggleBudgetRecurring(selectedYear, category);
      fetchBudget();
    } catch (error) {
      console.error('Error toggling recurring:', error);
      alert('Failed to update recurring status');
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

      await db.updateBudgetAmounts(selectedYear, category, updatedAmounts);
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

  // Create a real bill (in the Bills tab) from this category's amount for the CURRENT real-world month
  const handleCreateBill = async (category) => {
    const categoryData = categories.find(c => c.category === category);

    const now = new Date();
    const realMonth = now.getMonth() + 1;
    const realYear = now.getFullYear();
    const amount = categoryData?.amounts?.[realMonth] || 0;

    if (selectedYear !== realYear) {
      const confirmed = window.confirm(
        `This will create a bill for ${monthsFull[realMonth - 1]} ${realYear} (the current month) using the ${category} amount from that month's column ($${amount}). Continue?`
      );
      if (!confirmed) return;
    }

    const dueDayInput = window.prompt(`What day of the month is "${category}" due?`, '1');
    if (dueDayInput === null) return; // cancelled

    const dueDay = parseInt(dueDayInput);
    if (!dueDay || dueDay < 1 || dueDay > 31) {
      alert('Please enter a valid day (1-31)');
      return;
    }

    try {
      await db.addBill({
        name: category,
        amount: amount,
        due_day: dueDay,
        month: realMonth,
        year: realYear,
        is_paid: false
      });
      alert(`Bill created for "${category}"! Go to the Bills tab to view or edit it.`);
    } catch (error) {
      console.error('Error creating bill:', error);
      alert('Failed to create bill');
    }
  };

  // === Row reordering ===
  // Native HTML5 drag-and-drop (dragstart/dragover/drop) does NOT fire from
  // touch input on iOS Safari — that's why dragging never worked on the phone.
  // Pointer Events (pointerdown/pointermove/pointerup) work for both touch and
  // mouse, so reordering is implemented with those instead.
  const rowRefs = React.useRef({});

  const handlePointerDown = (e, category) => {
    e.preventDefault();
    setDraggedCategory(category);
    try {
      e.target.setPointerCapture(e.pointerId);
    } catch (err) {
      // ignore if pointer capture isn't supported
    }
  };

  const handlePointerMove = (e) => {
    if (!draggedCategory) return;
    const y = e.clientY;
    let foundCategory = null;

    for (const [cat, node] of Object.entries(rowRefs.current)) {
      if (!node) continue;
      const rect = node.getBoundingClientRect();
      if (y >= rect.top && y <= rect.bottom) {
        foundCategory = cat;
        break;
      }
    }

    if (foundCategory && foundCategory !== dragOverCategory) {
      setDragOverCategory(foundCategory);
    }
  };

  const handlePointerUp = async () => {
    if (!draggedCategory) return;

    const sourceCategory = draggedCategory;
    const targetCategory = dragOverCategory;
    setDraggedCategory(null);
    setDragOverCategory(null);

    if (!targetCategory || sourceCategory === targetCategory) return;

    const sorted = [...categories].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    const sourceIndex = sorted.findIndex(c => c.category === sourceCategory);
    const targetIndex = sorted.findIndex(c => c.category === targetCategory);

    if (sourceIndex === -1 || targetIndex === -1) return;

    const reordered = [...sorted];
    const [removed] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, removed);

    const orders = reordered.map((cat, idx) => ({ category: cat.category, order: idx }));

    // Optimistic UI update
    setCategories(reordered.map((cat, idx) => ({ ...cat, display_order: idx })));

    try {
      await db.updateBudgetOrder(selectedYear, orders);
    } catch (error) {
      console.error('Error reordering categories:', error);
      fetchBudget();
    }
  };

  const exportToCSV = () => {
    let csv = `Category,${months.join(',')},Total\n`;

    categories.forEach(cat => {
      const amounts = months.map((_, idx) => {
        const month = idx + 1;
        return cat.amounts?.[month] || 0;
      });
      const total = amounts.reduce((sum, amt) => sum + amt, 0);
      csv += `${cat.category},${amounts.join(',')},${total}\n`;
    });

    const monthlyTotals = months.map((_, idx) => {
      const month = idx + 1;
      return categories.reduce((sum, cat) => sum + (cat.amounts?.[month] || 0), 0);
    });
    const grandTotal = monthlyTotals.reduce((sum, amt) => sum + amt, 0);
    csv += `TOTAL,${monthlyTotals.join(',')},${grandTotal}\n`;

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

  const sortedCategories = [...categories].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

  // Zoom is done with real CSS sizing (font-size/padding/column width via CSS
  // variables), NOT transform or the `zoom` property — both of those break
  // position:sticky's offset math in Safari, which is what caused the category
  // column to drift/slide off while scrolling. This way the sticky columns are
  // genuinely frozen at every zoom step, like Excel.
  const zoomSteps = [100, 90, 80, 70, 60, 50];
  const zoomIndex = zoomSteps.indexOf(zoom);
  const zoomIn = () => setZoom(zoomSteps[Math.max(0, zoomIndex - 1)]);
  const zoomOut = () => setZoom(zoomSteps[Math.min(zoomSteps.length - 1, zoomIndex + 1)]);

  const zoomVars = {
    100: { fontSize: '14px', padding: '12px', monthWidth: '90px' },
    90: { fontSize: '13px', padding: '10px', monthWidth: '80px' },
    80: { fontSize: '12px', padding: '9px', monthWidth: '72px' },
    70: { fontSize: '11px', padding: '7px', monthWidth: '64px' },
    60: { fontSize: '10px', padding: '6px', monthWidth: '56px' },
    50: { fontSize: '9px', padding: '5px', monthWidth: '48px' },
  }[zoom];

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

        <div className="zoom-controls">
          <button onClick={zoomOut} className="zoom-btn" title="Zoom Out">－</button>
          <span className="zoom-level">{zoom}%</span>
          <button onClick={zoomIn} className="zoom-btn" title="Zoom In">＋</button>
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

      {/* Zoom shrinks real font-size/padding/column-width via CSS variables —
          no transform or `zoom`, so the frozen columns stay genuinely frozen. */}
      <div
        className="grid-wrapper"
        style={{
          '--cell-font-size': zoomVars.fontSize,
          '--cell-padding': zoomVars.padding,
          '--month-col-width': zoomVars.monthWidth,
        }}
      >
        <table className="budget-grid">
          <thead>
            <tr>
              <th className="drag-header sticky-col"></th>
              <th className="category-header sticky-col">Category</th>
              <th className="recurring-header">Recurring</th>
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
            {sortedCategories.length === 0 ? (
              <tr>
                <td colSpan={18} className="empty-state">
                  No categories yet. Click "+ Add Category" to get started.
                </td>
              </tr>
            ) : (
              <>
                {sortedCategories.map((cat) => (
                  <tr
                    key={cat.category}
                    ref={(el) => (rowRefs.current[cat.category] = el)}
                    className={
                      (draggedCategory === cat.category ? 'dragging-row ' : '') +
                      (dragOverCategory === cat.category && draggedCategory !== cat.category ? 'drag-over-row' : '')
                    }
                  >
                    <td className="drag-cell sticky-col">
                      <span
                        className="drag-handle"
                        onPointerDown={(e) => handlePointerDown(e, cat.category)}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        title="Drag to reorder"
                      >
                        ⋮⋮
                      </span>
                    </td>
                    <td className="category-cell sticky-col">{cat.category}</td>
                    <td className="recurring-cell">
                      <input
                        type="checkbox"
                        checked={!!cat.is_recurring}
                        onChange={() => handleToggleRecurring(cat.category)}
                        title="Auto-create this bill on the 1st of each month"
                      />
                    </td>
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
                        onClick={() => handleCreateBill(cat.category)}
                        className="create-bill-btn"
                        title="Create Bill from this category"
                      >
                        📝
                      </button>
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
                  <td className="drag-cell sticky-col"></td>
                  <td className="category-cell sticky-col"><strong>TOTAL</strong></td>
                  <td className="recurring-cell"></td>
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

    </div>
  );
}

export default BudgetGrid;
