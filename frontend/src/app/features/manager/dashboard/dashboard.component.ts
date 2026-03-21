import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { DashboardService, DriverStatus } from '../../../core/services/dashboard.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { environment } from '../../../../environments/environment';

interface ProjectAllocation {
  project: string;
  hours: number;
  percentage: number;
  driverCount: number;
  color: string | null;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit, OnDestroy {
  drivers: DriverStatus[] = [];
  projectAllocation: ProjectAllocation[] = [];
  loading = true;
  error: string | null = null;
  lastRefresh = '';
  alerts: { message: string; type: string }[] = [];

  private destroy$ = new Subject<void>();

  constructor(
    private dashboardService: DashboardService,
    private wsService: WebSocketService,
    private router: Router,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    // Initial load
    this.loadDashboard();

    // Connect WebSocket and listen for events
    this.wsService.connect();

    this.wsService
      .getEvents()
      .pipe(takeUntil(this.destroy$))
      .subscribe((event) => {
        if (event.type === 'clock_in' || event.type === 'clock_out') {
          // Refresh dashboard on any clock event
          this.loadDashboard();
        }

        if (event.type === 'ot_alert') {
          const driver = this.drivers.find((d) => d.id === event.data.userId);
          const name = driver?.name || 'A driver';
          this.alerts.unshift({
            message: `OT Alert: ${name} has ${event.data.hours}h (${event.data.alertType})`,
            type: event.data.alertType,
          });
          // Keep max 5 alerts
          if (this.alerts.length > 5) this.alerts.pop();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.wsService.disconnect();
  }

  onDriverClick(driver: DriverStatus): void {
    this.router.navigate(['/manager/driver', driver.id]);
  }

  dismissAlert(index: number): void {
    this.alerts.splice(index, 1);
  }

  get activeCount(): number {
    return this.drivers.filter((d) => d.status === 'clocked_in').length;
  }

  formatTime(isoString: string): string {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private loadDashboard(): void {
    this.dashboardService.getDashboard().subscribe({
      next: (res) => {
        this.drivers = res.data.drivers;
        this.loading = false;
        this.lastRefresh = new Date().toLocaleTimeString();
        this.error = null;
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to load dashboard';
        this.loading = false;
      },
    });

    this.http.get<any>(`${environment.apiUrl}/manager/project-allocation`).subscribe({
      next: (res) => {
        this.projectAllocation = res.data.allocation;
      },
    });
  }
}
