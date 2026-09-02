// IndexedDB wrapper for local storage
const DB_NAME = 'CashFlowDB';
const DB_VERSION = 3;

class LocalDB {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create accounts store
        if (!db.objectStoreNames.contains('accounts')) {
          const accountStore = db.createObjectStore('accounts', { keyPath: 'id', autoIncrement: true });
          accountStore.createIndex('type', 'type', { unique: false });
          accountStore.createIndex('display_order', 'display_order', { unique: false });
        }

        // Create bills store
        if (!db.objectStoreNames.contains('bills')) {
          const billStore = db.createObjectStore('bills', { keyPath: 'id', autoIncrement: true });
          billStore.createIndex('month_year', ['month', 'year'], { unique: false });
        }

        // Create budget grid store
        if (!db.objectStoreNames.contains('budget')) {
          const budgetStore = db.createObjectStore('budget', { keyPath: 'id', autoIncrement: true });
          budgetStore.createIndex('year_category', ['year', 'category'], { unique: true });
        }

        // Create meta store (small key/value settings, e.g. last auto-generate month)
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }

        // Create reserves store
        if (!db.objectStoreNames.contains('reserves')) {
          db.createObjectStore('reserves', { keyPath: 'id', autoIncrement: true });
        }

        // Create income store
        if (!db.objectStoreNames.contains('income')) {
          db.createObjectStore('income', { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  }

  // === ACCOUNTS ===

  async getAccounts() {
    const transaction = this.db.transaction(['accounts'], 'readonly');
    const store = transaction.objectStore('accounts');
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async addAccount(account) {
    const transaction = this.db.transaction(['accounts'], 'readwrite');
    const store = transaction.objectStore('accounts');

    const getAllRequest = store.getAll();

    return new Promise((resolve, reject) => {
      getAllRequest.onsuccess = () => {
        const accounts = getAllRequest.result || [];
        const maxOrder = accounts.reduce((max, acc) => Math.max(max, acc.display_order || 0), -1);

        const newAccount = {
          ...account,
          display_order: maxOrder + 1,
          last_updated: new Date().toISOString(),
          hidden: false
        };

        const addRequest = store.add(newAccount);
        addRequest.onsuccess = () => resolve({ ...newAccount, id: addRequest.result });
        addRequest.onerror = () => reject(addRequest.error);
      };
      getAllRequest.onerror = () => reject(getAllRequest.error);
    });
  }

  async updateAccount(id, updates) {
    const transaction = this.db.transaction(['accounts'], 'readwrite');
    const store = transaction.objectStore('accounts');
    const getRequest = store.get(id);

    return new Promise((resolve, reject) => {
      getRequest.onsuccess = () => {
        const account = getRequest.result;
        if (!account) {
          reject(new Error('Account not found'));
          return;
        }

        const updatedAccount = {
          ...account,
          ...updates,
          last_updated: new Date().toISOString()
        };

        const putRequest = store.put(updatedAccount);
        putRequest.onsuccess = () => resolve(updatedAccount);
        putRequest.onerror = () => reject(putRequest.error);
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async deleteAccount(id) {
    const transaction = this.db.transaction(['accounts'], 'readwrite');
    const store = transaction.objectStore('accounts');
    const request = store.delete(id);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async updateAccountOrder(accountOrders) {
    const transaction = this.db.transaction(['accounts'], 'readwrite');
    const store = transaction.objectStore('accounts');

    const promises = accountOrders.map(({ accountId, order }) => {
      return new Promise((resolve, reject) => {
        const getRequest = store.get(accountId);
        getRequest.onsuccess = () => {
          const account = getRequest.result;
          if (account) {
            account.display_order = order;
            const putRequest = store.put(account);
            putRequest.onsuccess = () => resolve();
            putRequest.onerror = () => reject(putRequest.error);
          } else {
            resolve();
          }
        };
        getRequest.onerror = () => reject(getRequest.error);
      });
    });

    return Promise.all(promises);
  }

  // === BILLS ===

  async getBills(month, year) {
    const transaction = this.db.transaction(['bills'], 'readonly');
    const store = transaction.objectStore('bills');
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const bills = request.result || [];
        const filtered = bills.filter(b => b.month === month && b.year === year);
        resolve(filtered.sort((a, b) => a.due_day - b.due_day));
      };
      request.onerror = () => reject(request.error);
    });
  }

  // All bills, unfiltered - used to find unpaid bills that predate the current month (carry-forward)
  async getAllBills() {
    const transaction = this.db.transaction(['bills'], 'readonly');
    const store = transaction.objectStore('bills');
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async addBill(bill) {
    const transaction = this.db.transaction(['bills'], 'readwrite');
    const store = transaction.objectStore('bills');
    const request = store.add(bill);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve({ ...bill, id: request.result });
      request.onerror = () => reject(request.error);
    });
  }

  async updateBill(id, updates) {
    const transaction = this.db.transaction(['bills'], 'readwrite');
    const store = transaction.objectStore('bills');
    const getRequest = store.get(id);

    return new Promise((resolve, reject) => {
      getRequest.onsuccess = () => {
        const bill = getRequest.result;
        if (!bill) {
          reject(new Error('Bill not found'));
          return;
        }

        const updatedBill = { ...bill, ...updates };
        const putRequest = store.put(updatedBill);
        putRequest.onsuccess = () => resolve(updatedBill);
        putRequest.onerror = () => reject(putRequest.error);
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async deleteBill(id) {
    const transaction = this.db.transaction(['bills'], 'readwrite');
    const store = transaction.objectStore('bills');
    const request = store.delete(id);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  // Toggles a bill's "scheduled" flag - for bills that are auto-scheduled
  // (autopay queued) but haven't cleared yet, distinct from paid/unpaid.
  async toggleBillScheduled(id) {
    const transaction = this.db.transaction(['bills'], 'readwrite');
    const store = transaction.objectStore('bills');
    const getRequest = store.get(id);

    return new Promise((resolve, reject) => {
      getRequest.onsuccess = () => {
        const bill = getRequest.result;
        if (!bill) {
          reject(new Error('Bill not found'));
          return;
        }
        const updated = { ...bill, is_scheduled: !bill.is_scheduled };
        const putRequest = store.put(updated);
        putRequest.onsuccess = () => resolve(updated);
        putRequest.onerror = () => reject(putRequest.error);
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // === META (small settings like "last auto-generate month") ===

  async getMeta(key) {
    const transaction = this.db.transaction(['meta'], 'readonly');
    const store = transaction.objectStore('meta');
    const request = store.get(key);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result ? request.result.value : null);
      request.onerror = () => reject(request.error);
    });
  }

  async setMeta(key, value) {
    const transaction = this.db.transaction(['meta'], 'readwrite');
    const store = transaction.objectStore('meta');
    const request = store.put({ key, value });

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  // Auto-create bills from any budget category marked "recurring", using that
  // category's amount and due day for the current real-world month. Skips any
  // category whose amount for this month is $0 — nothing to bill for yet.
  // Runs once per month (tracked via the meta store) no matter how many times
  // the app is opened. Bill names are stamped with the month (e.g. "Electric -
  // Sep 2026") so multiple unpaid months of the same bill stay distinguishable.
  async autoGenerateBills() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const monthAbbrev = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1];

    const last = await this.getMeta('lastAutoGenerate');
    if (last && last.month === month && last.year === year) {
      return { generated: false, count: 0 };
    }

    const budgets = await this.getBudgetForYear(year);
    const recurring = budgets.filter(b => b.is_recurring);

    const existingBills = await this.getBills(month, year);
    const existingNames = new Set(existingBills.map(b => b.name));

    let count = 0;
    for (const cat of recurring) {
      const amount = (cat.amounts && cat.amounts[month]) || 0;
      if (amount === 0) continue; // don't auto-populate a bill with no budgeted amount

      const billName = `${cat.category} - ${monthAbbrev} ${year}`;
      if (existingNames.has(billName)) continue; // don't duplicate if it already exists

      await this.addBill({
        name: billName,
        amount,
        due_day: cat.due_day || 1,
        month,
        year,
        is_paid: false,
        is_scheduled: false
      });
      count++;
    }

    await this.setMeta('lastAutoGenerate', { month, year });
    return { generated: true, count };
  }

  // === BUDGET GRID ===

  async getBudgetForYear(year) {
    const transaction = this.db.transaction(['budget'], 'readonly');
    const store = transaction.objectStore('budget');
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const budgets = request.result || [];
        const filtered = budgets
          .filter(b => b.year === year)
          .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
        resolve(filtered);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async addBudgetCategory(year, category) {
    const transaction = this.db.transaction(['budget'], 'readwrite');
    const store = transaction.objectStore('budget');
    const getAllRequest = store.getAll();

    return new Promise((resolve, reject) => {
      getAllRequest.onsuccess = () => {
        const all = getAllRequest.result || [];
        const sameYear = all.filter(b => b.year === year);
        const maxOrder = sameYear.reduce((max, b) => Math.max(max, b.display_order || 0), -1);

        const amounts = {};
        for (let i = 1; i <= 12; i++) amounts[i] = 0;

        const newBudget = {
          year,
          category,
          amounts,
          is_recurring: false,
          due_day: 1,
          display_order: maxOrder + 1
        };

        const addRequest = store.add(newBudget);
        addRequest.onsuccess = () => resolve({ ...newBudget, id: addRequest.result });
        addRequest.onerror = () => reject(addRequest.error);
      };
      getAllRequest.onerror = () => reject(getAllRequest.error);
    });
  }

  // Used internally by copyBudgetYear to add a category with existing data
  // (amounts, recurring flag, due day) rather than a blank template.
  async _addBudgetCategoryWithData(year, category, amounts, is_recurring, due_day) {
    const transaction = this.db.transaction(['budget'], 'readwrite');
    const store = transaction.objectStore('budget');
    const getAllRequest = store.getAll();

    return new Promise((resolve, reject) => {
      getAllRequest.onsuccess = () => {
        const all = getAllRequest.result || [];
        const sameYear = all.filter(b => b.year === year);
        const maxOrder = sameYear.reduce((max, b) => Math.max(max, b.display_order || 0), -1);

        const newBudget = {
          year,
          category,
          amounts: { ...amounts },
          is_recurring: !!is_recurring,
          due_day: due_day || 1,
          display_order: maxOrder + 1
        };

        const addRequest = store.add(newBudget);
        addRequest.onsuccess = () => resolve({ ...newBudget, id: addRequest.result });
        addRequest.onerror = () => reject(addRequest.error);
      };
      getAllRequest.onerror = () => reject(getAllRequest.error);
    });
  }

  // Copies every category from one year into another. Categories that already
  // exist (by name) in the target year are skipped, never overwritten -
  // the caller shows a warning first when the target year already has data.
  async copyBudgetYear(fromYear, toYear) {
    const source = await this.getBudgetForYear(fromYear);
    const existingTarget = await this.getBudgetForYear(toYear);
    const existingNames = new Set(existingTarget.map(c => c.category));

    let copied = 0;
    let skipped = 0;

    for (const cat of source) {
      if (existingNames.has(cat.category)) {
        skipped++;
        continue;
      }
      await this._addBudgetCategoryWithData(toYear, cat.category, cat.amounts, cat.is_recurring, cat.due_day);
      copied++;
    }

    return { copied, skipped, existingCount: existingTarget.length };
  }

  async updateBudgetDueDay(year, category, due_day) {
    const transaction = this.db.transaction(['budget'], 'readwrite');
    const store = transaction.objectStore('budget');
    const index = store.index('year_category');
    const getRequest = index.get([year, category]);

    return new Promise((resolve, reject) => {
      getRequest.onsuccess = () => {
        const existing = getRequest.result;
        if (!existing) {
          reject(new Error('Budget category not found'));
          return;
        }
        const updated = { ...existing, due_day: parseInt(due_day) || 1 };
        const putRequest = store.put(updated);
        putRequest.onsuccess = () => resolve(updated);
        putRequest.onerror = () => reject(putRequest.error);
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // Combined update used by the per-category Setup panel: recurring flag,
  // due day, a reference "typical amount", and free-text notes, saved together.
  async updateBudgetSetup(year, category, { is_recurring, due_day, default_amount, notes }) {
    const transaction = this.db.transaction(['budget'], 'readwrite');
    const store = transaction.objectStore('budget');
    const index = store.index('year_category');
    const getRequest = index.get([year, category]);

    return new Promise((resolve, reject) => {
      getRequest.onsuccess = () => {
        const existing = getRequest.result;
        if (!existing) {
          reject(new Error('Budget category not found'));
          return;
        }
        const updated = {
          ...existing,
          is_recurring: !!is_recurring,
          due_day: parseInt(due_day) || 1,
          default_amount: parseFloat(default_amount) || 0,
          notes: notes || ''
        };
        const putRequest = store.put(updated);
        putRequest.onsuccess = () => resolve(updated);
        putRequest.onerror = () => reject(putRequest.error);
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async updateBudgetAmounts(year, category, amounts) {
    const transaction = this.db.transaction(['budget'], 'readwrite');
    const store = transaction.objectStore('budget');
    const index = store.index('year_category');
    const getRequest = index.get([year, category]);

    return new Promise((resolve, reject) => {
      getRequest.onsuccess = () => {
        const existing = getRequest.result;
        if (!existing) {
          reject(new Error('Budget category not found'));
          return;
        }
        const updated = { ...existing, amounts };
        const putRequest = store.put(updated);
        putRequest.onsuccess = () => resolve(updated);
        putRequest.onerror = () => reject(putRequest.error);
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async toggleBudgetRecurring(year, category) {
    const transaction = this.db.transaction(['budget'], 'readwrite');
    const store = transaction.objectStore('budget');
    const index = store.index('year_category');
    const getRequest = index.get([year, category]);

    return new Promise((resolve, reject) => {
      getRequest.onsuccess = () => {
        const existing = getRequest.result;
        if (!existing) {
          reject(new Error('Budget category not found'));
          return;
        }
        const updated = { ...existing, is_recurring: !existing.is_recurring };
        const putRequest = store.put(updated);
        putRequest.onsuccess = () => resolve(updated);
        putRequest.onerror = () => reject(putRequest.error);
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async updateBudgetOrder(year, categoryOrders) {
    // categoryOrders: [{ category, order }]
    const transaction = this.db.transaction(['budget'], 'readwrite');
    const store = transaction.objectStore('budget');
    const index = store.index('year_category');

    const promises = categoryOrders.map(({ category, order }) => {
      return new Promise((resolve, reject) => {
        const getRequest = index.get([year, category]);
        getRequest.onsuccess = () => {
          const existing = getRequest.result;
          if (existing) {
            existing.display_order = order;
            const putRequest = store.put(existing);
            putRequest.onsuccess = () => resolve();
            putRequest.onerror = () => reject(putRequest.error);
          } else {
            resolve();
          }
        };
        getRequest.onerror = () => reject(getRequest.error);
      });
    });

    return Promise.all(promises);
  }

  async deleteBudgetCategory(year, category) {
    const transaction = this.db.transaction(['budget'], 'readwrite');
    const store = transaction.objectStore('budget');
    const index = store.index('year_category');
    const getRequest = index.get([year, category]);

    return new Promise((resolve, reject) => {
      getRequest.onsuccess = () => {
        const existing = getRequest.result;
        if (existing) {
          const deleteRequest = store.delete(existing.id);
          deleteRequest.onsuccess = () => resolve(true);
          deleteRequest.onerror = () => reject(deleteRequest.error);
        } else {
          resolve(false);
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // === RESERVES ===

  async getReserves() {
    const transaction = this.db.transaction(['reserves'], 'readonly');
    const store = transaction.objectStore('reserves');
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const reserves = request.result || [];
        resolve(reserves.sort((a, b) => (a.display_order || 0) - (b.display_order || 0)));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async addReserve(reserve) {
    const transaction = this.db.transaction(['reserves'], 'readwrite');
    const store = transaction.objectStore('reserves');
    const getAllRequest = store.getAll();

    return new Promise((resolve, reject) => {
      getAllRequest.onsuccess = () => {
        const all = getAllRequest.result || [];
        const maxOrder = all.reduce((max, r) => Math.max(max, r.display_order || 0), -1);
        const newReserve = { ...reserve, display_order: maxOrder + 1 };

        const addRequest = store.add(newReserve);
        addRequest.onsuccess = () => resolve({ ...newReserve, id: addRequest.result });
        addRequest.onerror = () => reject(addRequest.error);
      };
      getAllRequest.onerror = () => reject(getAllRequest.error);
    });
  }

  async updateReserve(id, updates) {
    const transaction = this.db.transaction(['reserves'], 'readwrite');
    const store = transaction.objectStore('reserves');
    const getRequest = store.get(id);

    return new Promise((resolve, reject) => {
      getRequest.onsuccess = () => {
        const reserve = getRequest.result;
        if (!reserve) {
          reject(new Error('Reserve not found'));
          return;
        }
        const updated = { ...reserve, ...updates };
        const putRequest = store.put(updated);
        putRequest.onsuccess = () => resolve(updated);
        putRequest.onerror = () => reject(putRequest.error);
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async deleteReserve(id) {
    const transaction = this.db.transaction(['reserves'], 'readwrite');
    const store = transaction.objectStore('reserves');
    const request = store.delete(id);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  // === EXPECTED INCOME ===

  async getIncome() {
    const transaction = this.db.transaction(['income'], 'readonly');
    const store = transaction.objectStore('income');
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async addIncome(entry) {
    const transaction = this.db.transaction(['income'], 'readwrite');
    const store = transaction.objectStore('income');
    const request = store.add(entry);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve({ ...entry, id: request.result });
      request.onerror = () => reject(request.error);
    });
  }

  async updateIncome(id, updates) {
    const transaction = this.db.transaction(['income'], 'readwrite');
    const store = transaction.objectStore('income');
    const getRequest = store.get(id);

    return new Promise((resolve, reject) => {
      getRequest.onsuccess = () => {
        const entry = getRequest.result;
        if (!entry) {
          reject(new Error('Income entry not found'));
          return;
        }
        const updated = { ...entry, ...updates };
        const putRequest = store.put(updated);
        putRequest.onsuccess = () => resolve(updated);
        putRequest.onerror = () => reject(putRequest.error);
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async deleteIncome(id) {
    const transaction = this.db.transaction(['income'], 'readwrite');
    const store = transaction.objectStore('income');
    const request = store.delete(id);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  // === EXPORT/IMPORT ===

  async exportData() {
    const accounts = await this.getAccounts();
    const reserves = await this.getReserves();
    const income = await this.getIncome();

    const billTransaction = this.db.transaction(['bills'], 'readonly');
    const billStore = billTransaction.objectStore('bills');
    const billsRequest = billStore.getAll();

    const budgetTransaction = this.db.transaction(['budget'], 'readonly');
    const budgetStore = budgetTransaction.objectStore('budget');
    const budgetRequest = budgetStore.getAll();

    return new Promise((resolve, reject) => {
      billsRequest.onsuccess = () => {
        const bills = billsRequest.result || [];

        budgetRequest.onsuccess = () => {
          const budget = budgetRequest.result || [];

          resolve({
            version: 3,
            exportDate: new Date().toISOString(),
            accounts,
            bills,
            budget,
            reserves,
            income
          });
        };
        budgetRequest.onerror = () => reject(budgetRequest.error);
      };
      billsRequest.onerror = () => reject(billsRequest.error);
    });
  }

  async importData(data) {
    const storesToClear = ['accounts', 'bills', 'budget', 'reserves', 'income'];

    await Promise.all(storesToClear.map(storeName => {
      return new Promise((resolve, reject) => {
        const clearRequest = this.db.transaction([storeName], 'readwrite').objectStore(storeName).clear();
        clearRequest.onsuccess = () => resolve();
        clearRequest.onerror = () => reject(clearRequest.error);
      });
    }));

    // Import accounts
    const accountTransaction = this.db.transaction(['accounts'], 'readwrite');
    const accountStore = accountTransaction.objectStore('accounts');
    for (const account of data.accounts || []) {
      accountStore.add(account);
    }

    // Import bills
    const billTransaction = this.db.transaction(['bills'], 'readwrite');
    const billStore = billTransaction.objectStore('bills');
    for (const bill of data.bills || []) {
      billStore.add(bill);
    }

    // Import budget
    if (data.budget && data.budget.length > 0) {
      const budgetTransaction = this.db.transaction(['budget'], 'readwrite');
      const budgetStore = budgetTransaction.objectStore('budget');
      for (const budgetEntry of data.budget) {
        budgetStore.add(budgetEntry);
      }
    }

    // Import reserves
    if (data.reserves && data.reserves.length > 0) {
      const reserveTransaction = this.db.transaction(['reserves'], 'readwrite');
      const reserveStore = reserveTransaction.objectStore('reserves');
      for (const reserve of data.reserves) {
        reserveStore.add(reserve);
      }
    }

    // Import income
    if (data.income && data.income.length > 0) {
      const incomeTransaction = this.db.transaction(['income'], 'readwrite');
      const incomeStore = incomeTransaction.objectStore('income');
      for (const entry of data.income) {
        incomeStore.add(entry);
      }
    }

    return true;
  }
}

export const db = new LocalDB();
