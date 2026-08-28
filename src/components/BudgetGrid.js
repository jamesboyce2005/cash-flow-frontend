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

  const [categoryColWidth, setCategoryColWidth] = useState(() => {
    const saved = window.localStorage.getItem('budgetCategoryColWidth');
    return saved ? parseInt(saved) : 150;
  });
  const resizingRef = React.useRef(null);
  const rowRefs = React.useRef({});

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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

  const handleDueDayChange = async (category, value) => {
    const dueDay = parseInt(value);
    if (!dueDay || dueDay < 1 || dueDay > 31) return;

    try {
      await db.updateBudgetDueDay(selectedYear, category, dueDay);
      fetchBudget();
    } catch (error) {
      console.error('Error updating due day:', error);
      alert('Failed to update due day');
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

  // Copy every category from the prior year into this one. Categories that
  // already exist here (by name) are skipped, never overwritten.
  const handleCopyFromPriorYear = async () => {
    const sourceYear = selectedYear - 1;

    try {
      const sourceData = await db.getBudgetForYear(sourceYear);
      if (sourceData.length === 0) {
        alert(`${sourceYear} has no budget categories to copy.`);
        return;
      }

      let confirmMsg = `Copy ${sourceData.length} categor${sourceData.length === 1 ? 'y' : 'ies'} from ${sourceYear} into ${selectedYear}?`;
      if (categories.length > 0) {
        confirmMsg = `${selectedYear} already has ${categories.length} budget categor${categories.length === 1 ? 'y' : 'ies'}. Any names that already exist will be skipped (not overwritten) — only new categories from ${sourceYear} will be added. Continue?`;
      }

      if (!window.confirm(confirmMsg)) return;

      const result = await db.copyBudgetYear(sourceYear, selectedYear);
      fetchBudget();
      alert(
        `Copied ${result.copied} categor${result.copied === 1 ? 'y' : 'ies'} from ${sourceYear}.` +
        (result.skipped > 0 ? ` Skipped ${result.skipped} that already existed in ${selectedYear}.` : '')
      );
    } catch (error) {
      console.error('Error copying budget year:', error);
      alert('Failed to copy budget year');
    }
  };

  // === Row reordering ===
  // Native HTML5 drag-and-drop doesn't fire from touch input on iOS Safari,
  // so reordering uses Pointer Events (works for both touch and mouse).

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

    setCategories(reordered.map((cat, idx) => ({ ...cat, display_order: idx })));

    try {
      await db.updateBudgetOrder(selectedYear, orders);
    } catch (error) {
      console.error('Error reordering categories:', error);
      fetchBudget();
    }
  };

  // === Category column resize (drag the handle on the right edge) ===

  const handleResizeStart = (e) => {
    e.preventDefault();
    resizingRef.current = { startX: e.clientX, startWidth: categoryColWidth };
    try {
      e.target.setPointerCapture(e.pointerId);
    } catch (err) {
      // ignore
    }
  };

  const handleResizeMove = (e) => {
    if (!resizingRef.current) return;
    const delta = e.clientX - resizingRef.current.startX;
    const newWidth = Math.min(320, Math.max(80, resizingRef.current.startWidth + delta));
    setCategoryColWidth(newWidth);
  };

  const handleResizeEnd = () => {
    if (!resizingRef.current) return;
    resizingRef.current = null;
    window.localStorage.setItem('budgetCategoryColWidth', categoryColWidth.toString());
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
          <button onClick={handleCopyFromPriorYear} className="copy-year-btn">
            📋 Copy {selectedYear - 1} →
          </button>
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

      <div
        className="grid-wrapper"
        style={{
          '--cell-font-size': zoomVars.fontSize,
          '--cell-padding': zoomVars.padding,
          '--month-col-width': zoomVars.monthWidth,
          '--category-col-width': categoryColWidth + 'px',
        }}
      >
        <table className="budget-grid">
          <thead>
            <tr>
              <th className="drag-header sticky-col"></th>
              <th className="category-header sticky-col">
                Category
                <span
                  className="col-resize-handle"
                  onPointerDown={handleResizeStart}
                  onPointerMove={handleResizeMove}
                  onPointerUp={handleResizeEnd}
                  onPointerCancel={handleResizeEnd}
                  title="Drag to resize"
                />
              </th>
              <th className="recurring-header">Recurring</th>
              <th className="due-day-header">Due Day</th>
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
                <td colSpan={19} className="empty-state">
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
                    <td className="due-day-cell">
                      <input
                        type="number"
                        min="1"
                        max="31"
                        defaultValue={cat.due_day || 1}
                        key={`${cat.category}-${cat.due_day}`}
                        onBlur={(e) => handleDueDayChange(cat.category, e.target.value)}
                        className="due-day-input"
                        title="Day of month this bill is due when auto-created"
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
                  <td className="due-day-cell"></td>
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
        <p>🔁 Check "Recurring" to auto-create this bill on the 1st of each month using that month's amount and due day.</p>
      </div>
    </div>
  );
}

export default BudgetGrid;
