import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { HoursDisplayPipe } from '../../../shared/pipes/hours.pipe';
import { environment } from '../../../../environments/environment';

interface Alert {
  id: string;
  type: string;
  priority: string;
  title: string;
  message: string;
  employeeName: string | null;
  userId: string | null;
  timestamp: string;
  resolved: boolean;
}

@Component({
  selector: 'app-review-queue',
  standalone: true,
  imports: [CommonModule, TranslateModule, HoursDisplayPipe],
  templateUrl: './review-queue.component.html',
  styleUrls: ['./review-queue.component.scss'],
})
export class ReviewQueueComponent implements OnInit {
  alerts: Alert[] = [];
  loading = true;
  activeFilter: string = 'all';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadAlerts();
  }

  get filteredAlerts(): Alert[] {
    if (this.activeFilter === 'all') {
      return this.alerts;
    }
    return this.alerts.filter((a) => a.priority === this.activeFilter && !a.resolved);
  }

  get criticalCount(): number {
    return this.alerts.filter((a) => a.priority === 'critical' && !a.resolved).length;
  }

  get warningCount(): number {
    return this.alerts.filter((a) => a.priority === 'warning' && !a.resolved).length;
  }

  get infoCount(): number {
    return this.alerts.filter((a) => a.priority === 'info' && !a.resolved).length;
  }

  get allCount(): number {
    return this.alerts.length;
  }

  resolveAlert(alert: Alert): void {
    this.http.post(`${environment.apiUrl}/manager/alerts/${alert.id}/resolve`, {}).subscribe({
      next: () => {
        alert.resolved = true;
      },
    });
  }

  priorityClass(priority: string): string {
    return priority === 'critical' ? 'critical' : priority === 'warning' ? 'warning' : 'info';
  }

  typeIcon(type: string): string {
    switch (type) {
      case 'midnight_auto_close':
        return 'Forgot to clock out';
      case 'missing_clock_in':
        return 'No clock-in';
      case 'timesheet_flagged':
        return 'Anomaly detected';
      default:
        return type;
    }
  }

  formatTime(iso: string): string {
    return new Date(iso).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  private loadAlerts(): void {
    this.http.get<any>(`${environment.apiUrl}/manager/alerts`).subscribe({
      next: (res) => {
        this.alerts = res.data.alerts.map((a: any) => ({
          ...a,
          resolved: false,
        }));
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }
}
