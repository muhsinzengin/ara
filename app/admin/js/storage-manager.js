// Storage Manager - Güvenli local storage yönetimi
class StorageManager {
  constructor() {
    this.db = null;
    this.dbName = 'admin-panel';
    this.version = 1;
  }

  async init() {
    try {
      this.db = await idb.openDB(this.dbName, this.version, {
        upgrade(db) {
          // Calls tablosu
          if (!db.objectStoreNames.contains('calls')) {
            const callsStore = db.createObjectStore('calls', { keyPath: 'id' });
            callsStore.createIndex('timestamp', 'timestamp');
            callsStore.createIndex('status', 'status');
          }

          // History tablosu
          if (!db.objectStoreNames.contains('history')) {
            const historyStore = db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
            historyStore.createIndex('start_time', 'start_time');
            historyStore.createIndex('customer_name', 'customer_name');
          }

          // Settings tablosu
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'key' });
          }
        }
      });
      console.log('[Storage] IndexedDB initialized');
    } catch (err) {
      console.error('[Storage] Init error:', err);
      throw err;
    }
  }

  // Call yönetimi
  async saveCall(call) {
    try {
      const callData = {
        id: call.call_id,
        customer_name: call.customer_name,
        status: call.status,
        timestamp: new Date().toISOString(),
        ...call
      };
      await this.db.put('calls', callData);
    } catch (err) {
      console.error('[Storage] Save call error:', err);
    }
  }

  async getAllCalls() {
    try {
      return await this.db.getAll('calls');
    } catch (err) {
      console.error('[Storage] Get all calls error:', err);
      return [];
    }
  }

  async getCallById(id) {
    try {
      return await this.db.get('calls', id);
    } catch (err) {
      console.error('[Storage] Get call error:', err);
      return null;
    }
  }

  async deleteCall(id) {
    try {
      await this.db.delete('calls', id);
    } catch (err) {
      console.error('[Storage] Delete call error:', err);
    }
  }

  async clearCalls() {
    try {
      const tx = this.db.transaction('calls', 'readwrite');
      await tx.objectStore('calls').clear();
      await tx.done;
    } catch (err) {
      console.error('[Storage] Clear calls error:', err);
    }
  }

  // History yönetimi
  async saveHistory(call) {
    try {
      const historyData = {
        customer_name: call.customer_name,
        start_time: call.start_time,
        duration: call.duration,
        status: call.status,
        timestamp: new Date().toISOString()
      };
      await this.db.add('history', historyData);
    } catch (err) {
      console.error('[Storage] Save history error:', err);
    }
  }

  async getAllHistory() {
    try {
      return await this.db.getAll('history');
    } catch (err) {
      console.error('[Storage] Get all history error:', err);
      return [];
    }
  }

  async clearHistory() {
    try {
      const tx = this.db.transaction('history', 'readwrite');
      await tx.objectStore('history').clear();
      await tx.done;
    } catch (err) {
      console.error('[Storage] Clear history error:', err);
    }
  }

  // Settings yönetimi
  async saveSetting(key, value) {
    try {
      await this.db.put('settings', { key, value });
    } catch (err) {
      console.error('[Storage] Save setting error:', err);
    }
  }

  async getSetting(key) {
    try {
      const result = await this.db.get('settings', key);
      return result ? result.value : null;
    } catch (err) {
      console.error('[Storage] Get setting error:', err);
      return null;
    }
  }

  async getAllSettings() {
    try {
      return await this.db.getAll('settings');
    } catch (err) {
      console.error('[Storage] Get all settings error:', err);
      return [];
    }
  }

  // Export/Import
  async exportData() {
    try {
      const calls = await this.getAllCalls();
      const history = await this.getAllHistory();
      const settings = await this.getAllSettings();

      const data = {
        calls,
        history,
        settings,
        exportDate: new Date().toISOString(),
        version: this.version
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `admin-panel-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log('[Storage] Data exported successfully');
      return true;
    } catch (err) {
      console.error('[Storage] Export error:', err);
      return false;
    }
  }

  async importData(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.calls || !data.history || !data.settings) {
        throw new Error('Invalid backup file format');
      }

      // Clear existing data
      await this.clearCalls();
      await this.clearHistory();

      // Import calls
      for (const call of data.calls) {
        await this.db.put('calls', call);
      }

      // Import history
      for (const item of data.history) {
        await this.db.add('history', item);
      }

      // Import settings
      for (const setting of data.settings) {
        await this.db.put('settings', setting);
      }

      console.log('[Storage] Data imported successfully');
      return true;
    } catch (err) {
      console.error('[Storage] Import error:', err);
      return false;
    }
  }

  // Sync backend ile
  async syncToBackend() {
    try {
      const calls = await this.getAllCalls();
      const history = await this.getAllHistory();

      const res = await fetch('/api/sync-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calls, history })
      });

      const data = await res.json();
      if (data.success) {
        console.log('[Storage] Synced to backend');
        return true;
      }
      return false;
    } catch (err) {
      console.error('[Storage] Sync to backend error:', err);
      return false;
    }
  }

  async syncFromBackend() {
    try {
      const res = await fetch('/api/get-sync-data');
      const data = await res.json();

      if (data.success) {
        // Backend'den gelen verileri işle
        if (data.calls) {
          for (const call of data.calls) {
            await this.saveCall(call);
          }
        }

        if (data.history) {
          for (const item of data.history) {
            await this.saveHistory(item);
          }
        }

        console.log('[Storage] Synced from backend');
        return true;
      }
      return false;
    } catch (err) {
      console.error('[Storage] Sync from backend error:', err);
      return false;
    }
  }

  // Cleanup
  async cleanup() {
    try {
      if (this.db) {
        this.db.close();
        this.db = null;
      }
    } catch (err) {
      console.error('[Storage] Cleanup error:', err);
    }
  }
}
