import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { DashboardService, DriverStatus } from '../../../core/services/dashboard.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { environment } from '../../../../environments/environment';

interface ProjectAllocation {
  projectId: string | null;
  project: string;
  hours: number;
  percentage: number;
  driverCount: number;
  color: string | null;
  cost: number;
  budgetedHours: number | null;
  budgetAmount: number | null;
  editingBudget?: boolean;
  editBudgetedHours?: number | null;
  editBudgetAmount?: number | null;
}

interface Project {
  id: string;
  code: string;
  name: string;
  color: string | null;
  is_active: boolean;
}

interface ActionItems {
  pendingTimesheets: number;
  pendingTimeOff: number;
  unresolvedAlerts: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslateModule],
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
  showOffDrivers = false;

  // Action items
  actionItems: ActionItems = { pendingTimesheets: 0, pendingTimeOff: 0, unresolvedAlerts: 0 };

  private destroy$ = new Subject<void>();

  constructor(
    private dashboardService: DashboardService,
    private wsService: WebSocketService,
    private router: Router,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    this.http.get<any>(`${environment.apiUrl}/admin/projects`).subscribe({
      next: (res) => {
        this.projects = (res.data?.projects || []).filter((p: any) => p.is_active);
      },
    });

    this.loadDashboard();
    this.loadActionItems();

    this.wsService.connect();
    this.wsService
      .getEvents()
      .pipe(takeUntil(this.destroy$))
      .subscribe((event) => {
        if (event.type === 'clock_in' || event.type === 'clock_out') {
          this.loadDashboard();
        }
        if (event.type === 'ot_alert') {
          const driver = this.drivers.find((d) => d.id === event.data.userId);
          const name = driver?.name || 'A driver';
          this.alerts.unshift({
            message: `OT Alert: ${name} has ${event.data.hours}h (${event.data.alertType})`,
            type: event.data.alertType,
          });
          if (this.alerts.length > 5) this.alerts.pop();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.wsService.disconnect();
  }

  // Computed
  get activeDrivers(): DriverStatus[] {
    return this.drivers.filter((d) => d.status === 'clocked_in');
  }

  get offDrivers(): DriverStatus[] {
    return this.drivers.filter((d) => d.status === 'clocked_out');
  }

  get activeCount(): number {
    return this.activeDrivers.length;
  }

  get offCount(): number {
    return this.offDrivers.length;
  }

  get totalHoursToday(): number {
    return Math.round(this.drivers.reduce((sum, d) => sum + d.hours, 0) * 10) / 10;
  }

  get totalCostThisWeek(): number {
    return Math.round(this.projectAllocation.reduce((sum, p) => sum + p.cost, 0));
  }

  get hasActionItems(): boolean {
    return (
      this.actionItems.pendingTimesheets > 0 ||
      this.actionItems.pendingTimeOff > 0 ||
      this.actionItems.unresolvedAlerts > 0
    );
  }

  // Actions
  onDriverClick(driver: DriverStatus): void {
    this.router.navigate(['/manager/driver', driver.id]);
  }

  dismissAlert(index: number): void {
    this.alerts.splice(index, 1);
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

  startEditBudget(item: ProjectAllocation): void {
    item.editingBudget = true;
    item.editBudgetedHours = item.budgetedHours;
    item.editBudgetAmount = item.budgetAmount;
  }

  saveBudget(item: ProjectAllocation): void {
    if (!item.projectId) return;
    this.http
      .put<any>(`${environment.apiUrl}/admin/projects/${item.projectId}`, {
        budgetedHours: item.editBudgetedHours,
        budgetAmount: item.editBudgetAmount,
      })
      .subscribe({
        next: () => {
          item.budgetedHours = item.editBudgetedHours || null;
          item.budgetAmount = item.editBudgetAmount || null;
          item.editingBudget = false;
        },
      });
  }

  cancelEditBudget(item: ProjectAllocation): void {
    item.editingBudget = false;
  }

  formatTime(isoString: string): string {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatHours(h: number): string {
    const hrs = Math.floor(h);
    const mins = Math.round((h - hrs) * 60);
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
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

  private loadActionItems(): void {
    // Pending timesheets
    this.http.get<any>(`${environment.apiUrl}/manager/approvals/pending`).subscribe({
      next: (res) => {
        this.actionItems.pendingTimesheets = res.data?.timesheets?.length || 0;
      },
    });
    // Pending time-off
    this.http.get<any>(`${environment.apiUrl}/time-off/requests?status=pending`).subscribe({
      next: (res) => {
        this.actionItems.pendingTimeOff = res.data?.requests?.length || 0;
      },
    });
    // Unresolved alerts
    this.http.get<any>(`${environment.apiUrl}/manager/alerts`).subscribe({
      next: (res) => {
        this.actionItems.unresolvedAlerts = res.data?.unreadCount || 0;
      },
    });
  }
}
