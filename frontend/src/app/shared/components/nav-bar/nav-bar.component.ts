import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService, AuthUser } from '../../../core/services/auth.service';

interface NavLink {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-nav-bar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './nav-bar.component.html',
  styleUrls: ['./nav-bar.component.scss'],
})
export class NavBarComponent implements OnInit, OnDestroy {
  user: AuthUser | null = null;
  links: NavLink[] = [];
  menuOpen = false;

  private destroy$ = new Subject<void>();

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      this.user = user;
      this.links = this.getLinksForRole(user?.role);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu(): void {
    this.menuOpen = false;
  }

  logout(): void {
    this.authService.logout();
    this.menuOpen = false;
  }

  get isAuthenticated(): boolean {
    return !!this.user;
  }

  private getLinksForRole(role?: string): NavLink[] {
    if (!role) return [];

    const driverLinks: NavLink[] = [
      { path: '/clock', label: 'Clock', icon: '⏱' },
      { path: '/my-hours', label: 'My Hours', icon: '📊' },
      { path: '/my-timesheet', label: 'Timesheet', icon: '📋' },
    ];

    const managerLinks: NavLink[] = [
      { path: '/manager', label: 'Dashboard', icon: '📊' },
      { path: '/manager/approvals', label: 'Approvals', icon: '✓' },
      { path: '/manager/reports', label: 'Reports', icon: '📄' },
    ];

    switch (role) {
      case 'employee':
        return driverLinks;
      case 'manager':
        return [...managerLinks, ...driverLinks];
      case 'payroll_admin':
        return [
          { path: '/manager/reports', label: 'Reports', icon: '📄' },
          { path: '/manager/approvals', label: 'Approvals', icon: '✓' },
        ];
      case 'org_admin':
        return [
          { path: '/admin', label: 'Dashboard', icon: '🏢' },
          { path: '/admin/users', label: 'Users', icon: '👥' },
          { path: '/admin/settings', label: 'Settings', icon: '⚙' },
          { path: '/manager', label: 'Drivers', icon: '📊' },
          { path: '/manager/approvals', label: 'Approvals', icon: '✓' },
        ];
      default:
        return driverLinks;
    }
  }
}
