import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  cost: number;
}

interface Project {
  id: string;
  code: string;
  name: string;
  color: string | null;
  is_active: boolean;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit, OnDestroy {
  drivers: DriverStatus[] = [];
  projects: Project[] = [];
  projectAllocation: ProjectAllocation[] = [];
  loading = true;
  error: string | null = null;
  lastRefresh = '';
  alerts: { message: string; type: string }[] = [];
  assigningDriverId: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private dashboardService: DashboardService,
    private wsService: WebSocketService,
    private router: Router,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    // Load projects list
    this.http.get<any>(`${environment.apiUrl}/admin/projects`).subscribe({
      next: (res) => {
        this.projects = (res.data?.projects || []).filter((p: any) => p.is_active);
      },
    });

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

  assignProject(driver: DriverStatus, projectId: string): void {
    this.assigningDriverId = driver.id;
    this.http
      .post<any>(`${environment.apiUrl}/manager/driver/${driver.id}/assign-project`, {
        projectId: projectId || null,
      })
      .subscribe({
        next: () => {
          this.assigningDriverId = null;
          this.loadDashboard();
        },
        error: (err) => {
          this.assigningDriverId = null;
          this.error = err.error?.error || 'Failed to assign project';
        },
      });
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
