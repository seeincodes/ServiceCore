import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SyncService } from '../../../core/services/sync.service';

@Component({
  selector: 'app-offline-indicator',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="offline-banner" *ngIf="!(syncService.isOnline$ | async)">
      Offline - will sync when signal returns
    </div>
    <div class="sync-banner" *ngIf="syncService.syncing$ | async">Syncing...</div>
    <div class="sync-result" *ngIf="syncService.lastSyncResult$ | async as result">
      {{ result }}
    </div>
  `,
  styles: [
    `
      .offline-banner {
        background-color: #f57c00;
        color: white;
        text-align: center;
        padding: 8px;
        font-weight: 500;
        font-size: 14px;
      }
      .sync-banner {
        background-color: #1a73e8;
        color: white;
        text-align: center;
        padding: 8px;
        font-size: 14px;
      }
      .sync-result {
        background-color: #34a853;
        color: white;
        text-align: center;
        padding: 8px;
        font-size: 14px;
      }
    `,
  ],
})
export class OfflineIndicatorComponent {
  constructor(public syncService: SyncService) {}
}
