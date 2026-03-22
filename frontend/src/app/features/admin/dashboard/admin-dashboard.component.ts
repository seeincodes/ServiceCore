import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface DailyActiveEntry {
  label: string;
  count: number;
  pct: number;
}

interface WeeklyHoursEntry {
  label: string;
  hours: number;
  pct: number;
}

interface ProjectAllocation {
  project: string;
  hours: number;
  percentage: number;
  driverCount: number;
  color: string | null;
  cost: number;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss'],
})
export class AdminDashboardComponent implements OnInit {
  stats: {
    totalUsers: number;
    employeeCount: number;
    activeToday: number;
    pendingApprovals: number;
  } | null = null;

  dailyActiveData: DailyActiveEntry[] = [];
  weeklyHoursData: WeeklyHoursEntry[] = [];
  projectAllocation: ProjectAllocation[] = [];
  totalCost = 0;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<any>(`${environment.apiUrl}/admin/stats`).subscribe({
      next: (res) => (this.stats = res.data),
    });

    this.http.get<any>(`${environment.apiUrl}/manager/project-allocation`).subscribe({
      next: (res) => {
        this.projectAllocation = res.data?.allocation || [];
        this.totalCost = this.projectAllocation.reduce((sum, p) => sum + (p.cost || 0), 0);
      },
    });

    this.http.get<any>(`${environment.apiUrl}/admin/stats/trends`).subscribe({
      next: (res) => {
        this.processDailyActive(res.data?.dailyActive || []);
        this.processWeeklyHours(res.data?.weeklyHours || []);
      },
    });
  }

  private processDailyActive(days: Array<{ date: string; count: number }>): void {
    const recent = days.slice(-14);
    const max = Math.max(...recent.map((d) => d.count), 1);
    this.dailyActiveData = recent.map((d) => ({
      label: new Date(d.date).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
      }),
      count: d.count,
      pct: (d.count / max) * 100,
    }));
  }

  private processWeeklyHours(weeks: Array<{ weekEnding: string; hours: number }>): void {
    const max = Math.max(...weeks.map((w) => w.hours), 1);
    this.weeklyHoursData = weeks.map((w) => ({
      label: new Date(w.weekEnding).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
      }),
      hours: Math.round(w.hours * 10) / 10,
      pct: (w.hours / max) * 100,
    }));
  }
}
