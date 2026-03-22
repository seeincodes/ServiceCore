import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { ClockService, ClockStatus } from '../../../core/services/clock.service';
import { Subject, takeUntil, interval } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { HoursDisplayPipe } from '../../../shared/pipes/hours.pipe';
import { PreferencesService } from '../../../core/services/preferences.service';

interface AvailableRoute {
  id: string;
  name: string;
  projectId?: string;
  projectCode?: string;
}

interface Project {
  id: string;
  code: string;
  name: string;
  color: string | null;
}

interface RouteStop {
  name: string;
  notes?: string;
  eta?: string;
  lat: number;
  lon: number;
  completed?: boolean;
}

@Component({
  selector: 'app-clock-button',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, HoursDisplayPipe],
  templateUrl: './clock-button.component.html',
  styleUrls: ['./clock-button.component.scss'],
})
export class ClockButtonComponent implements OnInit, OnDestroy {
  status: ClockStatus = { clockedIn: false };
  loading = false;
  confirmation: { message: string; type: 'success' | 'error' } | null = null;
  elapsedDisplay = '';
  todayHoursNum = 0;
  todayHoursBase = 0; // completed sessions from backend
  weekHoursTotal = 0;
  onBreak = false;
  showEndDayConfirm = false;
  showRouteSwitch = false;

  // PIN
  showPinInput = false;
  showPinSetup = false;
  pinInput = '';
  setupPin = '';
  pinError = '';
  pinRequired = false;
  private pendingAction: 'clock_in' | 'break' | 'end_of_day' | 'end_of_day_confirmed' | null = null;

  get use24Hour(): boolean {
    return this.prefs.use24Hour;
  }
  get useMiles(): boolean {
    return this.prefs.useMiles;
  }

  // Project + Route picker
  projects: Project[] = [];
  selectedProjectId = '';
  availableRoutes: AvailableRoute[] = [];
  filteredRoutes: AvailableRoute[] = [];
  selectedRouteId = '';
  activeProjectName = '';
  activeRouteName = '';

  // Shift dashboard
  routeStops: RouteStop[] = [];
  completedStops = 0;
  showAllStops = false;

  get upcomingStops(): RouteStop[] {
    return this.routeStops.filter((s) => !s.completed);
  }
  remainingDistance = 0;
  nextStop: RouteStop | null = null;

  private destroy$ = new Subject<void>();
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private endDayTimeout: ReturnType<typeof setTimeout> | null = null;
  private toastTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private clockService: ClockService,
    private http: HttpClient,
    private prefs: PreferencesService,
  ) {}

  ngOnInit(): void {
    this.loadStatus();
    this.loadProjects();
    this.loadAvailableRoutes();
    this.startSilentTracking();
    this.checkPinRequired();
  }

  private checkPinRequired(): void {
    this.http.get<any>(`${environment.apiUrl}/auth/pin/status`).subscribe({
      next: (res) => {
        this.pinRequired = res.data?.pinSet || false;
        if (!this.pinRequired) {
          this.showPinSetup = true; // Prompt first-time setup
        }
      },
    });
  }

  requestPin(action: 'clock_in' | 'break' | 'end_of_day' | 'end_of_day_confirmed'): void {
    if (!this.pinRequired) {
      // No PIN set — proceed directly
      this.executeAction(action);
      return;
    }
    this.pendingAction = action;
    this.showPinInput = true;
    this.pinInput = '';
    this.pinError = '';
  }

  verifyAndAct(): void {
    if (this.pinInput.length !== 4 || !this.pendingAction) return;

    this.http.post<any>(`${environment.apiUrl}/auth/pin/verify`, { pin: this.pinInput }).subscribe({
      next: (res) => {
        if (res.data?.verified) {
          this.showPinInput = false;
          this.executeAction(this.pendingAction!);
          this.pendingAction = null;
          this.pinInput = '';
        }
      },
      error: () => {
        this.pinError = 'Incorrect PIN';
        this.pinInput = '';
      },
    });
  }

  saveSetupPin(): void {
    if (this.setupPin.length !== 4) return;
    this.http.post<any>(`${environment.apiUrl}/auth/pin/set`, { pin: this.setupPin }).subscribe({
      next: () => {
        this.pinRequired = true;
        this.showPinSetup = false;
        this.setupPin = '';
        this.showToast('PIN set successfully', 'success');
      },
      error: () => {
        this.pinError = 'Failed to set PIN';
      },
    });
  }

  skipPinSetup(): void {
    this.showPinSetup = false;
  }

  cancelPin(): void {
    this.showPinInput = false;
    this.pendingAction = null;
    this.pinInput = '';
    this.pinError = '';
  }

  private executeAction(action: string): void {
    switch (action) {
      case 'clock_in':
        this.onClockAction();
        break;
      case 'break':
        this.onClockOut('break');
        break;
      case 'end_of_day':
        this.confirmEndDay();
        break;
      case 'end_of_day_confirmed':
        this.onClockOut('end_of_day');
        break;
    }
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
        projectId: this.selectedProjectId || undefined,
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
          this.showToast(
            wasBreak
              ? `Back from break at ${this.formatTime(res.data.timestamp)}`
              : `Clocked in at ${this.formatTime(res.data.timestamp)}`,
            'success',
          );
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
          this.showToast(err.error?.error || 'Clock-in failed', 'error');
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
          this.todayHoursBase += res.data.hoursWorked;
          this.todayHoursNum = this.todayHoursBase;
          this.status = { clockedIn: false };
          this.stopTimer();
          this.onBreak = type === 'break';
          this.routeStops = [];
          this.nextStop = null;
          this.showRouteSwitch = false;
          const label = type === 'break' ? 'Break' : 'Done for today';
          const pipe = new HoursDisplayPipe();
          this.showToast(`${label} — ${pipe.transform(res.data.hoursWorked)} logged`, 'success');
          this.loading = false;
        },
        error: (err) => {
          this.showToast(err.error?.error || 'Clock-out failed', 'error');
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
                this.showToast(`Switched to ${route?.name || routeId}`, 'success');
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

  completeCurrentStop(): void {
    const idx = this.routeStops.findIndex((s) => !s.completed);
    if (idx >= 0) this.completeStop(idx);
  }

  completeStop(index: number): void {
    this.routeStops[index].completed = true;
    this.updateStopProgress();
    this.saveStopProgress();
  }

  private saveStopProgress(): void {
    if (!this.status.routeId) return;
    const completed = this.routeStops.filter((s) => s.completed).map((s) => s.name);
    localStorage.setItem(`stops-${this.status.routeId}`, JSON.stringify(completed));
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
    this.prefs.toggleTimeFormat();
  }

  private showToast(message: string, type: 'success' | 'error'): void {
    this.confirmation = { message, type };
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.confirmation = null;
    }, 4000);
  }

  private loadStatus(): void {
    this.clockService
      .getStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.status = res.data;
          this.todayHoursBase = res.data.todayHours ?? 0;
          this.todayHoursNum = this.todayHoursBase;
          if (this.status.clockedIn) {
            this.startTimer();
            this.loadRouteDetails();
          }
        },
      });

    // Load weekly hours for OT warning
    this.http.get<any>(`${environment.apiUrl}/timesheets/my-entries`).subscribe({
      next: (res) => {
        this.weekHoursTotal = res.data?.weekTotal || 0;
      },
    });
  }

  private loadProjects(): void {
    this.http.get<any>(`${environment.apiUrl}/admin/projects`).subscribe({
      next: (res) => {
        this.projects = (res.data.projects || []).filter((p: any) => p.is_active);
      },
    });
  }

  selectProject(projectId: string): void {
    this.selectedProjectId = projectId;
    this.selectedRouteId = '';
    this.filteredRoutes = this.availableRoutes.filter(
      (r) =>
        r.projectId === projectId ||
        r.projectCode === this.projects.find((p) => p.id === projectId)?.code,
    );
    if (this.filteredRoutes.length > 0) {
      this.selectedRouteId = this.filteredRoutes[0].id;
    }
  }

  private loadAvailableRoutes(): void {
    this.http.get<any>(`${environment.apiUrl}/dispatcher/routes`).subscribe({
      next: (res) => {
        const routes = res.data.routes || [];
        this.availableRoutes = routes.map((r: any) => ({
          id: r.id,
          name: r.name,
          projectId: r.projectId,
          projectCode: r.projectCode,
        }));
        this.filteredRoutes = [];
      },
    });
  }

  private loadRouteDetails(): void {
    // Set project name — resolve from loaded projects or fetch from API
    if (this.status.projectId) {
      const project = this.projects.find((p) => p.id === this.status.projectId);
      if (project) {
        this.activeProjectName = project.name;
      } else {
        // Projects not loaded yet — fetch name from API
        this.activeProjectName = '';
        this.http.get<any>(`${environment.apiUrl}/admin/projects`).subscribe({
          next: (res) => {
            const proj = (res.data.projects || []).find((p: any) => p.id === this.status.projectId);
            this.activeProjectName = proj?.name || '';
          },
        });
      }
    }

    if (!this.status.routeId) {
      this.activeRouteName = '';
      this.routeStops = [];
      this.nextStop = null;
      return;
    }

    const route = this.availableRoutes.find((r) => r.id === this.status.routeId);
    this.activeRouteName = route?.name || '';

    // Load waypoints for this route
    this.http.get<any>(`${environment.apiUrl}/dispatcher/routes`).subscribe({
      next: (res) => {
        const routes = res.data.routes || [];
        const myRoute = routes.find((r: any) => r.id === this.status.routeId);
        if (myRoute?.waypoints) {
          this.routeStops = myRoute.waypoints.map((wp: any) => ({
            name: wp.name,
            notes: wp.notes,
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
    const sessionElapsed =
      (Date.now() - new Date(this.status.clockInTime).getTime()) / (1000 * 60 * 60);
    const hours = Math.floor(sessionElapsed);
    const minutes = Math.floor((sessionElapsed - hours) * 60);
    this.elapsedDisplay = `${hours}h ${minutes}m`;
    this.todayHoursNum = this.todayHoursBase + sessionElapsed;
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
