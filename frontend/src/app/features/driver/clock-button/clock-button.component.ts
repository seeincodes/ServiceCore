import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { ClockService, ClockStatus } from '../../../core/services/clock.service';
import { Subject, takeUntil, interval } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { HoursDisplayPipe } from '../../../shared/pipes/hours.pipe';

interface AvailableRoute {
  id: string;
  name: string;
}

interface RouteStop {
  name: string;
  eta?: string;
  lat: number;
  lon: number;
  completed?: boolean;
}

@Component({
  selector: 'app-clock-button',
  standalone: true,
  imports: [CommonModule, TranslateModule, HoursDisplayPipe],
  templateUrl: './clock-button.component.html',
  styleUrls: ['./clock-button.component.scss'],
})
export class ClockButtonComponent implements OnInit, OnDestroy {
  status: ClockStatus = { clockedIn: false };
  loading = false;
  confirmation: { message: string; type: 'success' | 'error' } | null = null;
  elapsedDisplay = '';
  todayHoursNum = 0;
  use24Hour = false;
  onBreak = false;
  showEndDayConfirm = false;
  showRouteSwitch = false;

  // Route picker
  availableRoutes: AvailableRoute[] = [];
  selectedRouteId = '';
  activeRouteName = '';

  // Shift dashboard
  routeStops: RouteStop[] = [];
  completedStops = 0;
  remainingDistance = 0;
  nextStop: RouteStop | null = null;

  private destroy$ = new Subject<void>();
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private endDayTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private clockService: ClockService,
    private http: HttpClient,
  ) {
    this.use24Hour = localStorage.getItem('tk_time_format') === '24';
  }

  ngOnInit(): void {
    this.loadStatus();
    this.loadAvailableRoutes();
    this.startSilentTracking();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  onClockAction(): void {
    if (this.loading) return;
    this.loading = true;
    this.confirmation = null;

    this.clockService
      .clockIn({
        idempotencyKey: crypto.randomUUID(),
        routeId: this.selectedRouteId || undefined,
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
          const wasBreak = this.onBreak;
          this.onBreak = false;
          this.confirmation = {
            message: wasBreak
              ? `Back from break at ${this.formatTime(res.data.timestamp)}`
              : `Clocked in at ${this.formatTime(res.data.timestamp)}`,
            type: 'success',
          };
          this.loading = false;
          this.loadRouteDetails();

          // Send GPS in background
          this.getCurrentLocation().then((loc) => {
            if (loc) {
              this.http.post(`${environment.apiUrl}/timesheets/location-ping`, loc).subscribe();
            }
          });
        },
        error: (err) => {
          this.confirmation = {
            message: err.error?.error || 'Clock-in failed',
            type: 'error',
          };
          this.loading = false;
        },
      });
  }

  onClockOut(type: 'break' | 'end_of_day'): void {
    if (this.loading) return;
    this.loading = true;
    this.confirmation = null;
    this.showEndDayConfirm = false;

    this.clockService
      .clockOut(this.status.entryId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.status = { clockedIn: false };
          this.stopTimer();
          this.onBreak = type === 'break';
          this.routeStops = [];
          this.nextStop = null;
          this.showRouteSwitch = false;
          const label = type === 'break' ? 'Break' : 'Done for today';
          const pipe = new HoursDisplayPipe();
          this.confirmation = {
            message: `${label} — ${pipe.transform(res.data.hoursWorked)} logged`,
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
  }

  confirmEndDay(): void {
    this.showEndDayConfirm = true;
    if (this.endDayTimeout) clearTimeout(this.endDayTimeout);
    this.endDayTimeout = setTimeout(() => {
      this.showEndDayConfirm = false;
    }, 5000);
  }

  switchRoute(routeId: string): void {
    this.showRouteSwitch = false;
    this.loading = true;

    // Clock out current, then clock in with new route
    this.clockService
      .clockOut(this.status.entryId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.selectedRouteId = routeId;
          this.clockService
            .clockIn({ idempotencyKey: crypto.randomUUID(), routeId })
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (res) => {
                this.status = {
                  clockedIn: true,
                  entryId: res.data.entryId,
                  clockInTime: res.data.timestamp,
                  elapsedHours: 0,
                  routeId: res.data.routeId,
                };
                this.startTimer();
                this.loadRouteDetails();
                const route = this.availableRoutes.find((r) => r.id === routeId);
                this.confirmation = {
                  message: `Switched to ${route?.name || routeId}`,
                  type: 'success',
                };
                this.loading = false;
              },
              error: () => {
                this.loading = false;
                this.loadStatus();
              },
            });
        },
        error: () => {
          this.loading = false;
        },
      });
  }

  navigateToStop(): void {
    if (!this.nextStop) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${this.nextStop.lat},${this.nextStop.lon}&travelmode=driving`;
    window.open(url, '_blank');
  }

  formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString([], {
      hour: this.use24Hour ? '2-digit' : 'numeric',
      minute: '2-digit',
      hour12: !this.use24Hour,
    });
  }

  toggleTimeFormat(): void {
    this.use24Hour = !this.use24Hour;
    localStorage.setItem('tk_time_format', this.use24Hour ? '24' : '12');
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
            this.loadRouteDetails();
          }
        },
      });
  }

  private loadAvailableRoutes(): void {
    this.http.get<any>(`${environment.apiUrl}/dispatcher/routes`).subscribe({
      next: (res) => {
        const routes = res.data.routes || [];
        this.availableRoutes = routes.map((r: any) => ({
          id: r.id,
          name: r.name,
        }));
        // Pre-select first route
        if (this.availableRoutes.length > 0 && !this.selectedRouteId) {
          this.selectedRouteId = this.availableRoutes[0].id;
        }
      },
    });
  }

  private loadRouteDetails(): void {
    if (!this.status.routeId) {
      this.activeRouteName = '';
      this.routeStops = [];
      this.nextStop = null;
      return;
    }

    const route = this.availableRoutes.find((r) => r.id === this.status.routeId);
    this.activeRouteName = route?.name || this.status.routeId;

    // Load waypoints for this route
    this.http.get<any>(`${environment.apiUrl}/dispatcher/routes`).subscribe({
      next: (res) => {
        const routes = res.data.routes || [];
        const myRoute = routes.find((r: any) => r.id === this.status.routeId);
        if (myRoute?.waypoints) {
          this.routeStops = myRoute.waypoints.map((wp: any) => ({
            name: wp.name,
            lat: wp.lat,
            lon: wp.lon,
            completed: false,
          }));

          // Restore completed stops from localStorage
          const saved = localStorage.getItem(`stops-${this.status.routeId}`);
          if (saved) {
            const completedNames: string[] = JSON.parse(saved);
            this.routeStops.forEach((s) => {
              if (completedNames.includes(s.name)) s.completed = true;
            });
          }

          this.updateStopProgress();
        }
      },
    });
  }

  private updateStopProgress(): void {
    this.completedStops = this.routeStops.filter((s) => s.completed).length;
    const remaining = this.routeStops.filter((s) => !s.completed);
    this.nextStop = remaining.length > 0 ? remaining[0] : null;

    // Rough distance estimate (remaining stops * avg 2km)
    this.remainingDistance = Math.round(remaining.length * 2.1 * 10) / 10;
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
    this.todayHoursNum = elapsed;
  }

  private startSilentTracking(): void {
    interval(2 * 60 * 1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.getCurrentLocation().then((loc) => {
          if (!loc) return;
          this.http.post(`${environment.apiUrl}/timesheets/location-ping`, loc).subscribe({
            next: (res: any) => {
              if (res?.data?.action === 'auto_clock_in' || res?.data?.action === 'auto_clock_out') {
                this.loadStatus();
              }
            },
          });
        });
      });
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
