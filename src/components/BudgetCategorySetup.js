import React, { useState } from 'react';
import { db } from '../db';
import './BudgetCategorySetup.css';

function BudgetCategorySetup({ year, category, initialData, onClose, onSaved }) {
  const [isRecurring, setIsRecurring] = useState(!!initialData.is_recurring);
  const [dueDay, setDueDay] = useState((initialData.due_day || 1).toString());
  const [defaultAmount, setDefaultAmount] = useState(
    initialData.default_amount ? initialData.default_amount.toString() : ''
  );
  const [notes, setNotes] = useState(initialData.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await db.updateBudgetSetup(year, category, {
        is_recurring: isRecurring,
        due_day: parseInt(dueDay) || 1,
        default_amount: parseFloat(defaultAmount) || 0,
        notes
      });
      onSaved();
      onClose();
    } catch (error) {
      console.error('Error saving category setup:', error);
      alert('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="setup-overlay" onClick={onClose}>
      <div className="setup-modal" onClick={(e) => e.stopPropagation()}>
        <div className="setup-header">
          <h3>{category} — Setup</h3>
          <button className="setup-close" onClick={onClose}>✕</button>
        </div>

        <div className="setup-body">
          <label className="setup-checkbox-row">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
            />
            <span>Recurring — auto-create this bill on the 1st of each month</span>
          </label>

          <div className="setup-field">
            <label>Due Day of Month</label>
            <input
              type="number"
              min="1"
              max="31"
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
            />
          </div>

          <div className="setup-field">
            <label>Typical Amount <span className="setup-hint">(reference only)</span></label>
            <input
              type="number"
              step="0.01"
              value={defaultAmount}
              onChange={(e) => setDefaultAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="setup-field">
            <label>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., auto-pays from Chase checking"
              rows={3}
            />
          </div>
        </div>

        <div className="setup-actions">
          <button className="setup-save-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : '✓ Save'}
          </button>
          <button className="setup-cancel-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default BudgetCategorySetup;
