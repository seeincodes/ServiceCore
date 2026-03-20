import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="admin-dash">
      <h1>Admin Dashboard</h1>
      <div class="stats" *ngIf="stats">
        <div class="stat-card">
          <span class="stat-value">{{ stats.totalUsers }}</span>
          <span class="stat-label">Total Users</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ stats.employeeCount }}</span>
          <span class="stat-label">Employees</span>
        </div>
        <div class="stat-card highlight">
          <span class="stat-value">{{ stats.activeToday }}</span>
          <span class="stat-label">Active Now</span>
        </div>
        <div class="stat-card" [class.alert]="stats.pendingApprovals > 0">
          <span class="stat-value">{{ stats.pendingApprovals }}</span>
          <span class="stat-label">Pending Approvals</span>
        </div>
      </div>
      <div class="quick-links">
        <a routerLink="/admin/users" class="quick-link">Manage Users</a>
        <a routerLink="/admin/settings" class="quick-link">Org Settings</a>
        <a routerLink="/manager" class="quick-link">Driver Dashboard</a>
        <a routerLink="/manager/approvals" class="quick-link">Review Timesheets</a>
      </div>
    </div>
  `,
  styleUrls: ['./admin-dashboard.component.scss'],
})
export class AdminDashboardComponent implements OnInit {
  stats: {
    totalUsers: number;
    employeeCount: number;
    activeToday: number;
    pendingApprovals: number;
  } | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<any>(`${environment.apiUrl}/admin/stats`).subscribe({
      next: (res) => (this.stats = res.data),
    });
  }
}
