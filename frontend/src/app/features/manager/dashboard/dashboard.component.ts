import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil, interval, switchMap, startWith } from 'rxjs';
import { DashboardService, DriverStatus } from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit, OnDestroy {
  drivers: DriverStatus[] = [];
  loading = true;
  error: string | null = null;
  lastRefresh = '';

  private destroy$ = new Subject<void>();

  constructor(
    private dashboardService: DashboardService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    // Poll every 5 seconds
    interval(5000)
      .pipe(
        startWith(0),
        switchMap(() => this.dashboardService.getDashboard()),
        takeUntil(this.destroy$),
      )
      .subscribe({
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
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onDriverClick(driver: DriverStatus): void {
    this.router.navigate(['/manager/driver', driver.id]);
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
}
