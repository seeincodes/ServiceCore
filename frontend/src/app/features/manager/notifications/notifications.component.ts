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

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss'],
})
export class NotificationsComponent implements OnInit {
  notifications: Notification[] = [];
  loading = true;

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadNotifications();
  }

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
}
