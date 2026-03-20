import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DashboardService, DriverDayEntry } from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-driver-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './driver-detail.component.html',
  styleUrls: ['./driver-detail.component.scss'],
})
export class DriverDetailComponent implements OnInit {
  entries: DriverDayEntry[] = [];
  userId = '';
  loading = true;
  totalHours = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dashboardService: DashboardService,
  ) {}

  ngOnInit(): void {
    this.userId = this.route.snapshot.paramMap.get('userId') || '';
    this.loadEntries();
  }

  goBack(): void {
    this.router.navigate(['/manager']);
  }

  formatTime(isoString: string | null): string {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private loadEntries(): void {
    this.dashboardService.getDriverDay(this.userId).subscribe({
      next: (res) => {
        this.entries = res.data.entries;
        this.totalHours = this.entries.reduce((sum, e) => sum + (e.hours || 0), 0);
        this.totalHours = Math.round(this.totalHours * 100) / 100;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }
}
