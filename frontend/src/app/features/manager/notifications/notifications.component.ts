import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { environment } from '../../../../environments/environment';

interface InboxItem {
  id: string;
  source: 'notification' | 'alert';
  title: string;
  message: string;
  type: string;
  priority?: string;
  employeeName?: string;
  userId?: string;
  data?: Record<string, any>;
  timestamp: string;
  read?: boolean;
  resolved?: boolean;
}

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss'],
})
export class NotificationsComponent implements OnInit {
  items: InboxItem[] = [];
  loading = true;
  alertsLoading = true;
  activeFilter = 'all';

  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadNotifications();
    this.loadAlerts();
  }

  // Counts
  get allCount(): number {
    return this.items.length;
  }
  get unreadCount(): number {
    return this.items.filter((i) => i.source === 'notification' && !i.read).length;
  }
  get criticalCount(): number {
    return this.items.filter((i) => i.priority === 'critical' && !i.resolved).length;
  }
  get warningCount(): number {
    return this.items.filter((i) => i.priority === 'warning' && !i.resolved).length;
  }
  get infoCount(): number {
    return this.items.filter((i) => i.priority === 'info' && !i.resolved).length;
  }

  get filteredItems(): InboxItem[] {
    switch (this.activeFilter) {
      case 'notifications':
        return this.items.filter((i) => i.source === 'notification');
      case 'critical':
        return this.items.filter((i) => i.priority === 'critical' && !i.resolved);
      case 'warning':
        return this.items.filter((i) => i.priority === 'warning' && !i.resolved);
      case 'info':
        return this.items.filter((i) => i.priority === 'info' && !i.resolved);
      default:
        return this.items;
    }
  }

  // Actions
  markAsRead(item: InboxItem): void {
    if (item.read) return;
    this.http.post<any>(`${this.apiUrl}/manager/notifications/${item.id}/read`, {}).subscribe({
      next: () => {
        item.read = true;
      },
    });
  }

  markAllRead(): void {
    this.http.post<any>(`${this.apiUrl}/manager/notifications/read-all`, {}).subscribe({
      next: () => {
        this.items.filter((i) => i.source === 'notification').forEach((i) => (i.read = true));
      },
    });
  }

  resolveAlert(item: InboxItem): void {
    this.http.post<any>(`${this.apiUrl}/manager/alerts/${item.id}/resolve`, {}).subscribe({
      next: () => {
        item.resolved = true;
      },
    });
  }

  goToAction(item: InboxItem): void {
    this.markAsRead(item);
    const route = this.getActionRoute(item);
    if (route) {
      this.router.navigateByUrl(route);
    }
  }

  getActionRoute(item: InboxItem): string | null {
    const driverId = item.userId || item.data?.['userId'];

    switch (item.type) {
      case 'timesheet_submitted':
        return '/manager/approvals';
      case 'time_edit':
        return '/manager/approvals';
      case 'timesheet_flagged':
        return '/manager/approvals';
      case 'time_off_request':
        return '/manager/time-off';
      case 'ot_alert':
      case 'overtime_exceeded':
        return '/manager/reports';
      case 'missing_clock_in':
        return driverId ? `/manager/driver/${driverId}` : '/manager';
      case 'midnight_auto_close':
        return driverId ? `/manager/driver/${driverId}` : '/manager/approvals';
      case 'late_arrival':
        return driverId ? `/manager/driver/${driverId}` : '/manager';
      case 'schedule_conflict':
        return '/manager/schedule';
      default:
        return '/manager';
    }
  }

  getActionLabel(item: InboxItem): string {
    switch (item.type) {
      case 'timesheet_submitted':
      case 'timesheet_flagged':
        return 'Review';
      case 'time_edit':
        return 'View Edit';
      case 'time_off_request':
        return 'Review Request';
      case 'ot_alert':
      case 'overtime_exceeded':
        return 'View Report';
      case 'missing_clock_in':
      case 'late_arrival':
        return 'View Driver';
      case 'midnight_auto_close':
        return 'Review Entry';
      case 'schedule_conflict':
        return 'View Schedule';
      default:
        return 'View';
    }
  }

  // Display helpers
  itemClass(item: InboxItem): string {
    if (item.source === 'alert' && item.resolved) return 'resolved';
    if (item.source === 'notification' && item.read) return 'read';
    return 'unread';
  }

  indicatorClass(item: InboxItem): string {
    if (item.source === 'alert') {
      if (item.resolved) return 'dot-resolved';
      return item.priority === 'critical'
        ? 'dot-critical'
        : item.priority === 'warning'
          ? 'dot-warning'
          : 'dot-info';
    }
    return item.read ? 'dot-read' : 'dot-unread';
  }

  itemLabel(item: InboxItem): string {
    if (item.source === 'alert') {
      return item.priority || 'alert';
    }
    return item.type?.replace(/_/g, ' ') || 'notification';
  }

  labelClass(item: InboxItem): string {
    if (item.source === 'alert') {
      return `label-${item.priority || 'info'}`;
    }
    return 'label-notification';
  }

  itemTime(item: InboxItem): string {
    const d = new Date(item.timestamp);
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

  // Data loading
  private loadNotifications(): void {
    this.http.get<any>(`${this.apiUrl}/manager/notifications`).subscribe({
      next: (res) => {
        const notifs = res.data?.notifications || res.data || [];
        const mapped: InboxItem[] = notifs.map((n: any) => ({
          id: n.id,
          source: 'notification' as const,
          title: n.title,
          message: n.message,
          type: n.type,
          data: n.data || {},
          userId: n.data?.userId,
          timestamp: n.createdAt,
          read: !!n.readAt || !!n.read,
        }));
        this.items = [...this.items, ...mapped].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  private loadAlerts(): void {
    this.http.get<any>(`${this.apiUrl}/manager/alerts`).subscribe({
      next: (res) => {
        const alerts = res.data?.alerts || [];
        const mapped: InboxItem[] = alerts.map((a: any) => ({
          id: a.id,
          source: 'alert' as const,
          title: a.title,
          message: a.message,
          type: a.type,
          priority: a.priority,
          employeeName: a.employeeName,
          userId: a.userId,
          data: a.data || {},
          timestamp: a.timestamp,
          resolved: false,
        }));
        this.items = [...this.items, ...mapped].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );
        this.alertsLoading = false;
      },
      error: () => {
        this.alertsLoading = false;
      },
    });
  }
}
