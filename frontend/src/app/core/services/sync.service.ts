import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Subject, fromEvent, merge, takeUntil } from 'rxjs';
import { OfflineStoreService, OfflineClockEntry } from './offline-store.service';

interface SyncResponse {
  success: boolean;
  data: {
    syncedCount: number;
    errors: { index: number; error: string }[];
  };
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class SyncService implements OnDestroy {
  private apiUrl = 'http://localhost:3000/timesheets';
  private destroy$ = new Subject<void>();
  private isOnlineSubject = new BehaviorSubject<boolean>(navigator.onLine);
  private syncingSubject = new BehaviorSubject<boolean>(false);
  private lastSyncResultSubject = new BehaviorSubject<string | null>(null);

  isOnline$ = this.isOnlineSubject.asObservable();
  syncing$ = this.syncingSubject.asObservable();
  lastSyncResult$ = this.lastSyncResultSubject.asObservable();

  constructor(
    private http: HttpClient,
    private offlineStore: OfflineStoreService,
  ) {
    merge(fromEvent(window, 'online'), fromEvent(window, 'offline'))
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.isOnlineSubject.next(navigator.onLine);
        if (navigator.onLine) {
          this.syncPendingEntries();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get isOnline(): boolean {
    return this.isOnlineSubject.value;
  }

  async queueClockIn(params: {
    projectId?: string;
    routeId?: string;
    location?: { lat: number; lon: number };
  }): Promise<void> {
    const entry: OfflineClockEntry = {
      id: crypto.randomUUID(),
      action: 'clock_in',
      timestamp: new Date().toISOString(),
      projectId: params.projectId,
      routeId: params.routeId,
      location: params.location,
      idempotencyKey: crypto.randomUUID(),
    };
    await this.offlineStore.addEntry(entry);
  }

  async queueClockOut(entryId?: string): Promise<void> {
    const entry: OfflineClockEntry = {
      id: crypto.randomUUID(),
      action: 'clock_out',
      timestamp: new Date().toISOString(),
      idempotencyKey: crypto.randomUUID(),
      entryId,
    };
    await this.offlineStore.addEntry(entry);
  }

  async syncPendingEntries(): Promise<void> {
    if (this.syncingSubject.value || !navigator.onLine) return;

    const entries = await this.offlineStore.getAllEntries();
    if (entries.length === 0) return;

    this.syncingSubject.next(true);

    try {
      // Use batch sync endpoint
      const syncPayload = entries.map((e) => ({
        action: e.action,
        timestamp: e.timestamp,
        projectId: e.projectId,
        routeId: e.routeId,
        locationLat: e.location?.lat,
        locationLon: e.location?.lon,
        idempotencyKey: e.idempotencyKey,
        entryId: e.entryId,
      }));

      const res = await this.http
        .post<SyncResponse>(`${this.apiUrl}/sync`, syncPayload)
        .toPromise();

      if (res) {
        // Remove successfully synced entries
        const errorIndices = new Set(res.data.errors.map((e) => e.index));
        for (let i = 0; i < entries.length; i++) {
          if (!errorIndices.has(i)) {
            await this.offlineStore.removeEntry(entries[i].id);
          }
        }

        const synced = res.data.syncedCount;
        if (synced > 0) {
          this.lastSyncResultSubject.next(
            `Synced. ${synced} ${synced === 1 ? 'entry' : 'entries'} uploaded.`,
          );
        }
      }
    } catch {
      // Will retry on next reconnect
    }

    this.syncingSubject.next(false);
  }

  async getPendingCount(): Promise<number> {
    return this.offlineStore.getCount();
  }
}
