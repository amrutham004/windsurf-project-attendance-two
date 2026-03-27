/**
 * src/lib/offlineManager.ts - IndexedDB Offline Attendance Manager
 * 
 * Manages offline attendance storage and synchronization.
 * When the network is unavailable, attendance records (studentId, studentName,
 * face image, timestamp) are persisted to IndexedDB. When connectivity returns
 * the manager automatically replays each record through the standard
 * /mark-attendance endpoint so the backend processes them identically to
 * online submissions.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL !== undefined
    ? import.meta.env.VITE_API_URL
    : 'http://localhost:8000';

export interface OfflineAttendanceRecord {
    id?: number;
    studentId: string;
    studentName: string;
    image: string;
    timestamp: string;
    syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
    retryCount: number;
    lastError?: string;
}

export interface OfflineStats {
    pending: number;
    failed: number;
    total: number;
    isOnline: boolean;
    syncInProgress: boolean;
}

type StatusListener = (stats: OfflineStats) => void;

class OfflineManager {
    private dbName = 'AttendanceOfflineDB';
    private dbVersion = 2;
    private storeName = 'offlineAttendance';
    private db: IDBDatabase | null = null;
    private dbReady: Promise<void>;
    private syncInProgress = false;
    private retryTimer: number | null = null;
    private listeners: Set<StatusListener> = new Set();
    private static MAX_RETRIES = 5;
    private static RETRY_INTERVAL_MS = 30_000; // 30 seconds

    constructor() {
        this.dbReady = this.initDB();
        this.setupOnlineListener();
        this.startRetryTimer();
    }

    // ─── Database ──────────────────────────────────────────────

    private async initDB(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('[OfflineManager] Failed to open IndexedDB:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('[OfflineManager] IndexedDB ready');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                // Drop the old store if it exists (schema change)
                if (db.objectStoreNames.contains(this.storeName)) {
                    db.deleteObjectStore(this.storeName);
                }

                const store = db.createObjectStore(this.storeName, {
                    keyPath: 'id',
                    autoIncrement: true,
                });
                store.createIndex('syncStatus', 'syncStatus', { unique: false });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                store.createIndex('studentId', 'studentId', { unique: false });
            };
        });
    }

    private async ensureDB(): Promise<void> {
        await this.dbReady;
    }

    // ─── Connectivity ──────────────────────────────────────────

    private setupOnlineListener(): void {
        window.addEventListener('online', () => {
            console.log('[OfflineManager] Back online – starting sync');
            this.notifyListeners();
            this.syncPendingRecords();
        });

        window.addEventListener('offline', () => {
            console.log('[OfflineManager] Went offline – records will queue locally');
            this.notifyListeners();
        });
    }

    private startRetryTimer(): void {
        if (this.retryTimer) clearInterval(this.retryTimer);
        this.retryTimer = window.setInterval(() => {
            if (navigator.onLine && !this.syncInProgress) {
                this.syncPendingRecords();
            }
        }, OfflineManager.RETRY_INTERVAL_MS);
    }

    isOnline(): boolean {
        return navigator.onLine;
    }

    // ─── Storage ───────────────────────────────────────────────

    async storeRecord(record: {
        studentId: string;
        studentName: string;
        image: string;
        timestamp?: string;
    }): Promise<number> {
        await this.ensureDB();

        const offlineRecord: OfflineAttendanceRecord = {
            studentId: record.studentId,
            studentName: record.studentName,
            image: record.image,
            timestamp: record.timestamp || new Date().toISOString(),
            syncStatus: 'pending',
            retryCount: 0,
        };

        return new Promise((resolve, reject) => {
            const tx = this.db!.transaction([this.storeName], 'readwrite');
            const store = tx.objectStore(this.storeName);
            const req = store.add(offlineRecord);

            req.onsuccess = () => {
                const id = req.result as number;
                console.log(`[OfflineManager] Record stored #${id} for ${record.studentId}`);
                this.notifyListeners();
                resolve(id);
            };
            req.onerror = () => reject(req.error);
        });
    }

    async getPendingRecords(): Promise<OfflineAttendanceRecord[]> {
        await this.ensureDB();
        return new Promise((resolve, reject) => {
            const tx = this.db!.transaction([this.storeName], 'readonly');
            const store = tx.objectStore(this.storeName);
            const idx = store.index('syncStatus');

            // Get both 'pending' and 'failed' (for retry)
            const results: OfflineAttendanceRecord[] = [];
            const req = store.openCursor();
            req.onsuccess = (e) => {
                const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor) {
                    const rec = cursor.value as OfflineAttendanceRecord;
                    if (rec.syncStatus === 'pending' || (rec.syncStatus === 'failed' && rec.retryCount < OfflineManager.MAX_RETRIES)) {
                        results.push(rec);
                    }
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            req.onerror = () => reject(req.error);
        });
    }

    async getAllRecords(): Promise<OfflineAttendanceRecord[]> {
        await this.ensureDB();
        return new Promise((resolve, reject) => {
            const tx = this.db!.transaction([this.storeName], 'readonly');
            const req = tx.objectStore(this.storeName).getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    private async updateRecord(record: OfflineAttendanceRecord): Promise<void> {
        await this.ensureDB();
        return new Promise((resolve, reject) => {
            const tx = this.db!.transaction([this.storeName], 'readwrite');
            const req = tx.objectStore(this.storeName).put(record);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    private async deleteRecord(id: number): Promise<void> {
        await this.ensureDB();
        return new Promise((resolve, reject) => {
            const tx = this.db!.transaction([this.storeName], 'readwrite');
            const req = tx.objectStore(this.storeName).delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    // ─── Sync ──────────────────────────────────────────────────

    async syncPendingRecords(): Promise<{ synced: number; failed: number }> {
        if (this.syncInProgress || !navigator.onLine) {
            return { synced: 0, failed: 0 };
        }

        this.syncInProgress = true;
        this.notifyListeners();

        let synced = 0;
        let failed = 0;

        try {
            const pending = await this.getPendingRecords();
            if (pending.length === 0) return { synced: 0, failed: 0 };

            console.log(`[OfflineManager] Syncing ${pending.length} records…`);

            for (const record of pending) {
                try {
                    record.syncStatus = 'syncing';
                    await this.updateRecord(record);

                    const response = await fetch(`${API_BASE_URL}/mark-attendance`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            studentId: record.studentId,
                            studentName: record.studentName,
                            image: record.image,
                        }),
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (data.success) {
                            // Successfully synced — remove from IndexedDB
                            await this.deleteRecord(record.id!);
                            synced++;
                            console.log(`[OfflineManager] ✓ Synced ${record.studentId}`);
                        } else {
                            // Server rejected (e.g. face mismatch) — mark failed
                            record.syncStatus = 'failed';
                            record.retryCount++;
                            record.lastError = data.message || 'Server rejected';
                            await this.updateRecord(record);
                            failed++;
                        }
                    } else {
                        throw new Error(`HTTP ${response.status}`);
                    }
                } catch (err) {
                    // Network error — keep as pending for next retry
                    record.syncStatus = 'pending';
                    record.retryCount++;
                    record.lastError = err instanceof Error ? err.message : String(err);
                    await this.updateRecord(record);
                    failed++;
                    console.warn(`[OfflineManager] ✗ Failed ${record.studentId}:`, err);
                }
            }

            console.log(`[OfflineManager] Sync done: ${synced} synced, ${failed} failed`);
        } catch (error) {
            console.error('[OfflineManager] Sync error:', error);
        } finally {
            this.syncInProgress = false;
            this.notifyListeners();
        }

        return { synced, failed };
    }

    // ─── Status & Listeners ────────────────────────────────────

    subscribe(listener: StatusListener): () => void {
        this.listeners.add(listener);
        // Immediately fire current stats
        this.getStats().then(listener);
        return () => { this.listeners.delete(listener); };
    }

    private async notifyListeners(): Promise<void> {
        const stats = await this.getStats();
        this.listeners.forEach((fn) => {
            try { fn(stats); } catch (e) { console.error(e); }
        });
    }

    async getStats(): Promise<OfflineStats> {
        try {
            const all = await this.getAllRecords();
            return {
                pending: all.filter((r) => r.syncStatus === 'pending' || r.syncStatus === 'syncing').length,
                failed: all.filter((r) => r.syncStatus === 'failed').length,
                total: all.length,
                isOnline: navigator.onLine,
                syncInProgress: this.syncInProgress,
            };
        } catch {
            return { pending: 0, failed: 0, total: 0, isOnline: navigator.onLine, syncInProgress: false };
        }
    }

    async clearFailedRecords(): Promise<void> {
        await this.ensureDB();
        const all = await this.getAllRecords();
        for (const rec of all) {
            if (rec.syncStatus === 'failed' && rec.id) {
                await this.deleteRecord(rec.id);
            }
        }
        this.notifyListeners();
    }

    cleanup(): void {
        if (this.retryTimer) {
            clearInterval(this.retryTimer);
            this.retryTimer = null;
        }
    }
}

// Export singleton instance
export const offlineManager = new OfflineManager();
