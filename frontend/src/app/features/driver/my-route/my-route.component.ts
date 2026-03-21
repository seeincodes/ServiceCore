import { Component, OnInit, OnDestroy } from '@angular/core';
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
}

interface RouteStep {
  instruction: string;
  distanceKm: number;
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
  stops: RouteStop[] = [];
  markers: MapMarker[] = [];
  steps: RouteStep[] = [];
  routeName = 'My Route';
  totalDistance = 0;
  totalDuration = 0;
  loading = true;
  showDirections = false;
  clockInReminder: { message: string; zoneName: string } | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private http: HttpClient,
    private wsService: WebSocketService,
  ) {}

  ngOnInit(): void {
    this.loadRoute();
    this.startLocationChecks();

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

  toggleDirections(): void {
    this.showDirections = !this.showDirections;
  }

  private loadRoute(): void {
    // Get dispatcher routes for this org
    this.http.get<any>(`${environment.apiUrl}/dispatcher/routes`).subscribe({
      next: (res) => {
        const routes = res.data.routes || [];
        if (routes.length === 0) {
          this.loading = false;
          return;
        }

        // Find the route assigned to the current driver, or use the first one
        const myRoute = routes.find((r: any) => r.assignedDriverId) || routes[0];

        // Use waypoints if available (seeded routes have them)
        if (myRoute.waypoints?.length >= 2) {
          this.stops = myRoute.waypoints;
          this.routeName = myRoute.name;
        } else {
          this.stops = routes.slice(0, 8).map((r: any, i: number) => ({
            id: r.id || String(i),
            name: r.name || `Stop ${i + 1}`,
            lat: r.lat || 37.7749 + (Math.random() - 0.5) * 0.05,
            lon: r.lon || -122.4194 + (Math.random() - 0.5) * 0.05,
          }));
        }

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
        this.stops = res.data.stops || this.stops;
        this.totalDistance = res.data.totalDistanceKm;
        this.totalDuration = res.data.totalDurationMin;
        this.updateMarkers();

        // Get turn-by-turn directions
        this.http
          .post<any>(`${environment.apiUrl}/routes/directions`, { stops: this.stops })
          .subscribe({
            next: (dirRes) => {
              this.steps = dirRes.data.steps || [];
              this.loading = false;
            },
            error: () => {
              this.loading = false;
            },
          });
      },
      error: () => {
        // No ORS API key — just show stops on map
        this.updateMarkers();
        this.loading = false;
      },
    });
  }

  private updateMarkers(): void {
    this.markers = this.stops.map((s, i) => ({
      lat: s.lat,
      lon: s.lon,
      label: `${i + 1}. ${s.name}`,
      color: i === 0 ? ('blue' as const) : ('green' as const),
      popup: `<strong>${i + 1}. ${s.name}</strong>`,
    }));
  }

  private startLocationChecks(): void {
    // Check location every 5 minutes for smart clock-in
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
}
