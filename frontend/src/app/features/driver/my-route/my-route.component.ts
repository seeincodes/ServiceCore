import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, interval } from 'rxjs';
import { MapComponent, MapMarker } from '../../../shared/components/map/map.component';
import { WebSocketService } from '../../../core/services/websocket.service';
import { environment } from '../../../../environments/environment';

interface RouteStop {
  id: string;
  name: string;
  lat: number;
  lon: number;
  notes?: string;
  completed?: boolean;
  eta?: string; // formatted time string
  etaMinutes?: number; // minutes from now
}

interface RouteStep {
  instruction: string;
  distanceKm: number;
  durationMin: number;
}

// Per-segment durations from the optimize response
interface SegmentDuration {
  fromIndex: number;
  toIndex: number;
  durationMin: number;
}

@Component({
  selector: 'app-my-route',
  standalone: true,
  imports: [CommonModule, MapComponent],
  templateUrl: './my-route.component.html',
  styleUrls: ['./my-route.component.scss'],
})
export class MyRouteComponent implements OnInit, OnDestroy {
  @ViewChild('routeMap') routeMap!: MapComponent;

  stops: RouteStop[] = [];
  markers: MapMarker[] = [];
  steps: RouteStep[] = [];
  segmentDurations: number[] = []; // duration in minutes for each segment
  routeName = 'My Route';
  totalDistance = 0;
  totalDuration = 0;
  loading = true;
  showDirections = false;
  clockInReminder: { message: string; zoneName: string } | null = null;
  breakReminder = false;
  routeStartTime: Date | null = null;

  // Progress
  get completedCount(): number {
    return this.stops.filter((s) => s.completed).length;
  }
  get remainingCount(): number {
    return this.stops.filter((s) => !s.completed).length;
  }
  get progressPercent(): number {
    return this.stops.length > 0 ? Math.round((this.completedCount / this.stops.length) * 100) : 0;
  }

  private destroy$ = new Subject<void>();

  constructor(
    private http: HttpClient,
    private wsService: WebSocketService,
  ) {}

  ngOnInit(): void {
    this.loadRoute();
    this.startLocationChecks();
    this.startBreakTimer();

    // Listen for smart clock-in reminders
    this.wsService.connect();
    this.wsService
      .getEventsByType('clock_in_reminder')
      .pipe(takeUntil(this.destroy$))
      .subscribe((event) => {
        this.clockInReminder = {
          message: event.data.message,
          zoneName: event.data.zoneName,
        };
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  confirmClockIn(): void {
    this.http
      .post<any>(`${environment.apiUrl}/timesheets/clock-in`, {
        idempotencyKey: crypto.randomUUID(),
      })
      .subscribe({
        next: () => {
          this.clockInReminder = null;
        },
      });
  }

  dismissReminder(): void {
    this.clockInReminder = null;
  }

  dismissBreakReminder(): void {
    this.breakReminder = false;
  }

  focusStop(index: number): void {
    this.routeMap?.focusMarker(index);
  }

  navigateTo(stop: RouteStop, event: Event): void {
    event.stopPropagation();
    const url = `https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lon}&travelmode=driving`;
    window.open(url, '_blank');
  }

  toggleDirections(): void {
    this.showDirections = !this.showDirections;
  }

  markComplete(index: number, event: Event): void {
    event.stopPropagation();
    this.stops[index].completed = true;
    this.recalculateETAs();
    this.updateMarkers();

    // Save progress to localStorage
    this.saveProgress();
  }

  markIncomplete(index: number, event: Event): void {
    event.stopPropagation();
    this.stops[index].completed = false;
    this.recalculateETAs();
    this.updateMarkers();
    this.saveProgress();
  }

  private loadRoute(): void {
    this.http.get<any>(`${environment.apiUrl}/dispatcher/routes`).subscribe({
      next: (res) => {
        const routes = res.data.routes || [];
        if (routes.length === 0) {
          this.loading = false;
          return;
        }

        const myRoute = routes.find((r: any) => r.assignedDriverId) || routes[0];

        if (myRoute.waypoints?.length >= 2) {
          this.stops = myRoute.waypoints.map((wp: any) => ({
            ...wp,
            notes: wp.notes || null,
            completed: false,
          }));
          this.routeName = myRoute.name;
        } else {
          this.stops = routes.slice(0, 8).map((r: any, i: number) => ({
            id: r.id || String(i),
            name: r.name || `Stop ${i + 1}`,
            lat: r.lat || 37.7749 + (Math.random() - 0.5) * 0.05,
            lon: r.lon || -122.4194 + (Math.random() - 0.5) * 0.05,
            completed: false,
          }));
        }

        // Restore progress from localStorage
        this.restoreProgress();

        if (this.stops.length >= 2) {
          this.optimizeAndDisplay();
        } else {
          this.loading = false;
        }
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  private optimizeAndDisplay(): void {
    this.http.post<any>(`${environment.apiUrl}/routes/optimize`, { stops: this.stops }).subscribe({
      next: (res) => {
        const newStops = res.data.stops || this.stops;
        // Preserve completed state after reorder
        this.stops = newStops.map((s: RouteStop) => ({
          ...s,
          completed: this.stops.find((os) => os.id === s.id)?.completed || false,
        }));
        this.totalDistance = res.data.totalDistanceKm;
        this.totalDuration = res.data.totalDurationMin;
        this.routeStartTime = new Date();

        // Get turn-by-turn directions
        this.http
          .post<any>(`${environment.apiUrl}/routes/directions`, { stops: this.stops })
          .subscribe({
            next: (dirRes) => {
              this.steps = dirRes.data.steps || [];
              this.extractSegmentDurations(dirRes.data);
              this.recalculateETAs();
              this.updateMarkers();
              this.loading = false;
            },
            error: () => {
              this.updateMarkers();
              this.loading = false;
            },
          });
      },
      error: () => {
        this.updateMarkers();
        this.loading = false;
      },
    });
  }

  private extractSegmentDurations(dirData: any): void {
    // Each segment duration comes from the steps grouped by segment
    // For now estimate from total duration divided evenly, or from steps
    if (!this.steps.length || !this.stops.length) return;

    // Group steps by segment (we have N-1 segments for N stops)
    // Each segment's steps sum up to that segment's duration
    const segCount = this.stops.length - 1;
    const stepsPerSeg = Math.ceil(this.steps.length / segCount);
    this.segmentDurations = [];

    for (let i = 0; i < segCount; i++) {
      const segSteps = this.steps.slice(i * stepsPerSeg, (i + 1) * stepsPerSeg);
      const segDur = segSteps.reduce((sum, s) => sum + s.durationMin, 0);
      this.segmentDurations.push(segDur || Math.round(this.totalDuration / segCount));
    }
  }

  recalculateETAs(): void {
    const now = new Date();
    let cumulativeMin = 0;

    for (let i = 0; i < this.stops.length; i++) {
      if (i === 0) {
        // Depot — no ETA needed
        this.stops[i].eta = 'Start';
        this.stops[i].etaMinutes = 0;
        continue;
      }

      // Skip completed stops for cumulative time
      if (this.stops[i].completed) {
        this.stops[i].eta = 'Done';
        this.stops[i].etaMinutes = 0;
        continue;
      }

      // Find the previous non-completed stop to calculate from
      const segDur = this.segmentDurations[i - 1] || 5; // default 5 min
      cumulativeMin += segDur;

      const etaDate = new Date(now.getTime() + cumulativeMin * 60 * 1000);
      this.stops[i].eta = etaDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      this.stops[i].etaMinutes = cumulativeMin;
    }
  }

  private updateMarkers(): void {
    this.markers = this.stops.map((s, i) => ({
      lat: s.lat,
      lon: s.lon,
      label: `${i + 1}. ${s.name}`,
      color: s.completed ? ('gray' as const) : i === 0 ? ('blue' as const) : ('green' as const),
      popup: `<strong>${i + 1}. ${s.name}</strong>${s.completed ? ' (Done)' : ''}${s.notes ? `<br><em>${s.notes}</em>` : ''}`,
    }));
  }

  private startLocationChecks(): void {
    interval(5 * 60 * 1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            this.http
              .post(`${environment.apiUrl}/routes/check-location`, {
                lat: pos.coords.latitude,
                lon: pos.coords.longitude,
              })
              .subscribe();
          },
          () => {},
          { timeout: 5000 },
        );
      });
  }

  /** Alert driver to take a break after 4 hours of driving (DOT compliance). */
  private startBreakTimer(): void {
    // Check every 10 minutes if route has been active > 4 hours
    interval(10 * 60 * 1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (!this.routeStartTime) return;
        const hoursActive = (Date.now() - this.routeStartTime.getTime()) / (1000 * 60 * 60);
        if (hoursActive >= 4 && !this.breakReminder) {
          this.breakReminder = true;
        }
      });
  }

  private saveProgress(): void {
    const key = `route-progress:${this.routeName}`;
    const completed = this.stops.filter((s) => s.completed).map((s) => s.id);
    localStorage.setItem(key, JSON.stringify(completed));
  }

  private restoreProgress(): void {
    const key = `route-progress:${this.routeName}`;
    const saved = localStorage.getItem(key);
    if (!saved) return;

    try {
      const completedIds: string[] = JSON.parse(saved);
      for (const stop of this.stops) {
        if (completedIds.includes(stop.id)) {
          stop.completed = true;
        }
      }
    } catch {
      // Ignore corrupt data
    }
  }
}
