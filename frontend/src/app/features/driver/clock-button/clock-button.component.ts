import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ClockService, ClockStatus } from '../../../core/services/clock.service';
import { Subject, takeUntil, interval, switchMap, startWith } from 'rxjs';

@Component({
  selector: 'app-clock-button',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './clock-button.component.html',
  styleUrls: ['./clock-button.component.scss'],
})
export class ClockButtonComponent implements OnInit, OnDestroy {
  status: ClockStatus = { clockedIn: false };
  loading = false;
  confirmation: { message: string; type: 'success' | 'error' } | null = null;
  elapsedDisplay = '';

  private destroy$ = new Subject<void>();
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private clockService: ClockService) {}

  ngOnInit(): void {
    this.loadStatus();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  onClockAction(): void {
    if (this.loading) return;
    this.loading = true;
    this.confirmation = null;

    if (this.status.clockedIn) {
      this.clockService
        .clockOut(this.status.entryId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res) => {
            this.status = { clockedIn: false };
            this.stopTimer();
            const time = new Date(res.data.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });
            this.confirmation = {
              message: `Clocked out at ${time}. Total: ${res.data.hoursWorked}h`,
              type: 'success',
            };
            this.loading = false;
          },
          error: (err) => {
            this.confirmation = {
              message: err.error?.error || 'Clock-out failed',
              type: 'error',
            };
            this.loading = false;
          },
        });
    } else {
      this.getCurrentLocation().then((location) => {
        this.clockService
          .clockIn({
            location,
            idempotencyKey: crypto.randomUUID(),
          })
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (res) => {
              this.status = {
                clockedIn: true,
                entryId: res.data.entryId,
                clockInTime: res.data.timestamp,
                elapsedHours: 0,
                routeId: res.data.routeId,
                projectId: res.data.projectId,
              };
              this.startTimer();
              const time = new Date(res.data.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });
              const route = res.data.routeId ? `, Route #${res.data.routeId}` : '';
              this.confirmation = {
                message: `Clocked in at ${time}${route}`,
                type: 'success',
              };
              this.loading = false;
            },
            error: (err) => {
              this.confirmation = {
                message: err.error?.error || 'Clock-in failed',
                type: 'error',
              };
              this.loading = false;
            },
          });
      });
    }
  }

  private loadStatus(): void {
    this.clockService
      .getStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.status = res.data;
          if (this.status.clockedIn) {
            this.startTimer();
          }
        },
        error: () => {
          // Offline or not authenticated — default to not clocked in
        },
      });
  }

  private startTimer(): void {
    this.updateElapsed();
    this.timerInterval = setInterval(() => this.updateElapsed(), 60_000);
  }

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.elapsedDisplay = '';
  }

  private updateElapsed(): void {
    if (!this.status.clockInTime) return;
    const elapsed = (Date.now() - new Date(this.status.clockInTime).getTime()) / (1000 * 60 * 60);
    const hours = Math.floor(elapsed);
    const minutes = Math.floor((elapsed - hours) * 60);
    this.elapsedDisplay = `${hours}h ${minutes}m`;
  }

  private getCurrentLocation(): Promise<{ lat: number; lon: number } | undefined> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(undefined);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => resolve(undefined),
        { timeout: 5000, enableHighAccuracy: false },
      );
    });
  }
}
