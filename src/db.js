// IndexedDB wrapper for local storage
const DB_NAME = 'CashFlowDB';
const DB_VERSION = 2;

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
    
    // Get max display_order within this transaction
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

  // === EXPORT/IMPORT ===

  async exportData() {
    const accounts = await this.getAccounts();
    
    // Get all bills
    const billTransaction = this.db.transaction(['bills'], 'readonly');
    const billStore = billTransaction.objectStore('bills');
    const billsRequest = billStore.getAll();

    // Get all budget data
    const budgetTransaction = this.db.transaction(['budget'], 'readonly');
    const budgetStore = budgetTransaction.objectStore('budget');
    const budgetRequest = budgetStore.getAll();

    return new Promise((resolve, reject) => {
      let bills = [];
      let budget = [];

      billsRequest.onsuccess = () => {
        bills = billsRequest.result || [];
        
        budgetRequest.onsuccess = () => {
          budget = budgetRequest.result || [];
          
          resolve({
            version: 2,
            exportDate: new Date().toISOString(),
            accounts,
            bills,
            budget
          });
        };
        budgetRequest.onerror = () => reject(budgetRequest.error);
      };
      billsRequest.onerror = () => reject(billsRequest.error);
    });
  }

  async importData(data) {
    // Clear existing data
    const clearAccounts = this.db.transaction(['accounts'], 'readwrite').objectStore('accounts').clear();
    const clearBills = this.db.transaction(['bills'], 'readwrite').objectStore('bills').clear();
    const clearBudget = this.db.transaction(['budget'], 'readwrite').objectStore('budget').clear();

    await Promise.all([
      new Promise((resolve, reject) => {
        clearAccounts.onsuccess = () => resolve();
        clearAccounts.onerror = () => reject(clearAccounts.error);
      }),
      new Promise((resolve, reject) => {
        clearBills.onsuccess = () => resolve();
        clearBills.onerror = () => reject(clearBills.error);
      }),
      new Promise((resolve, reject) => {
        clearBudget.onsuccess = () => resolve();
        clearBudget.onerror = () => reject(clearBudget.error);
      })
    ]);

    // Import accounts
    const accountTransaction = this.db.transaction(['accounts'], 'readwrite');
    const accountStore = accountTransaction.objectStore('accounts');
    for (const account of data.accounts) {
      accountStore.add(account);
    }

    // Import bills
    const billTransaction = this.db.transaction(['bills'], 'readwrite');
    const billStore = billTransaction.objectStore('bills');
    for (const bill of data.bills) {
      billStore.add(bill);
    }

    // Import budget (if exists in backup)
    if (data.budget && data.budget.length > 0) {
      const budgetTransaction = this.db.transaction(['budget'], 'readwrite');
      const budgetStore = budgetTransaction.objectStore('budget');
      for (const budgetEntry of data.budget) {
        budgetStore.add(budgetEntry);
      }

      return new Promise((resolve) => {
        budgetTransaction.oncomplete = () => resolve(true);
      });
    } else {
      return new Promise((resolve) => {
        billTransaction.oncomplete = () => resolve(true);
      });
    }
  }

  // === BUDGET GRID ===

  async getBudgetForYear(year) {
    const transaction = this.db.transaction(['budget'], 'readonly');
    const store = transaction.objectStore('budget');
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const budgets = request.result || [];
        const filtered = budgets.filter(b => b.year === year);
        resolve(filtered);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveBudgetCategory(year, category, amounts) {
    const transaction = this.db.transaction(['budget'], 'readwrite');
    const store = transaction.objectStore('budget');
    const index = store.index('year_category');
    const getRequest = index.get([year, category]);

    return new Promise((resolve, reject) => {
      getRequest.onsuccess = () => {
        const existing = getRequest.result;
        
        if (existing) {
          // Update existing
          const updated = { ...existing, amounts };
          const putRequest = store.put(updated);
          putRequest.onsuccess = () => resolve(updated);
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          // Create new
          const newBudget = { year, category, amounts };
          const addRequest = store.add(newBudget);
          addRequest.onsuccess = () => resolve({ ...newBudget, id: addRequest.result });
          addRequest.onerror = () => reject(addRequest.error);
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
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
}

export const db = new LocalDB();
