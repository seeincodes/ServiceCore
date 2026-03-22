import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

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
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss'],
})
export class NotificationsComponent implements OnInit {
  // Main tab
  mainTab: 'notifications' | 'alerts' = 'notifications';

  notifications: Notification[] = [];
  loading = true;

  // Alerts data
  alerts: Alert[] = [];
  alertsLoading = false;
  activeFilter: string = 'all';

  private apiUrl = environment.apiUrl;
  private alertsLoaded = false;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadNotifications();
    this.loadAlerts();
  }

  // ---- Notifications ----

  get unreadCount(): number {
    return this.notifications.filter((n) => !n.read).length;
  }

  markAsRead(notification: Notification): void {
    if (notification.read) return;
    this.http
      .post<any>(`${this.apiUrl}/manager/notifications/${notification.id}/read`, {})
      .subscribe({
        next: () => {
          notification.read = true;
        },
      });
  }

  markAllRead(): void {
    this.http.post<any>(`${this.apiUrl}/manager/notifications/read-all`, {}).subscribe({
      next: () => {
        this.notifications.forEach((n) => (n.read = true));
      },
    });
  }

  typeIcon(type: string): string {
    switch (type) {
      case 'approval':
        return '\u2713';
      case 'alert':
        return '!';
      case 'timeoff':
        return '\u2709';
      case 'schedule':
        return '\u{1F4C5}';
      default:
        return '\u2139';
    }
  }

  typeClass(type: string): string {
    switch (type) {
      case 'approval':
        return 'icon-success';
      case 'alert':
        return 'icon-danger';
      case 'timeoff':
        return 'icon-warning';
      case 'schedule':
        return 'icon-primary';
      default:
        return 'icon-default';
    }
  }

  formatTimestamp(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  }

  // ---- Alerts ----

  switchMainTab(tab: 'notifications' | 'alerts'): void {
    this.mainTab = tab;
    if (tab === 'alerts' && !this.alertsLoaded) {
      this.alertsLoaded = true;
      this.loadAlerts();
    }
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

  get allAlertCount(): number {
    return this.alerts.length;
  }

  resolveAlert(alert: Alert): void {
    this.http.post(`${this.apiUrl}/manager/alerts/${alert.id}/resolve`, {}).subscribe({
      next: () => {
        alert.resolved = true;
      },
    });
  }

  priorityClass(priority: string): string {
    return priority === 'critical' ? 'critical' : priority === 'warning' ? 'warning' : 'info';
  }

  alertTypeIcon(type: string): string {
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

  formatAlertTime(iso: string): string {
    return new Date(iso).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  // ---- Private ----

  private loadNotifications(): void {
    this.http.get<{ data: Notification[] }>(`${this.apiUrl}/manager/notifications`).subscribe({
      next: (res) => {
        this.notifications = res.data || [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  private loadAlerts(): void {
    this.alertsLoading = true;
    this.http.get<any>(`${this.apiUrl}/manager/alerts`).subscribe({
      next: (res) => {
        this.alerts = (res.data?.alerts || []).map((a: any) => ({
          ...a,
          resolved: false,
        }));
        this.alertsLoading = false;
      },
      error: () => {
        this.alertsLoading = false;
      },
    });
  }
}
