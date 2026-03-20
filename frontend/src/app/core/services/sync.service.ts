import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Subject, fromEvent, merge, takeUntil } from 'rxjs';
import { OfflineStoreService, OfflineClockEntry } from './offline-store.service';

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
    // Listen for online/offline events
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
    let synced = 0;

    for (const entry of entries) {
      try {
        if (entry.action === 'clock_in') {
          await this.http
            .post(`${this.apiUrl}/clock-in`, {
              projectId: entry.projectId,
              routeId: entry.routeId,
              location: entry.location,
              idempotencyKey: entry.idempotencyKey,
            })
            .toPromise();
        } else {
          await this.http.post(`${this.apiUrl}/clock-out`, { entryId: entry.entryId }).toPromise();
        }
        await this.offlineStore.removeEntry(entry.id);
        synced++;
      } catch {
        // Stop on first failure — will retry later
        break;
      }
    }

    this.syncingSubject.next(false);
    if (synced > 0) {
      this.lastSyncResultSubject.next(
        `Synced. ${synced} ${synced === 1 ? 'entry' : 'entries'} uploaded.`,
      );
    }
  }

  async getPendingCount(): Promise<number> {
    return this.offlineStore.getCount();
  }
}
