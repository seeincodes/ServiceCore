import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService, AuthUser } from '../../../core/services/auth.service';

interface NavLink {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-nav-bar',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule],
  templateUrl: './nav-bar.component.html',
  styleUrls: ['./nav-bar.component.scss'],
})
export class NavBarComponent implements OnInit, OnDestroy {
  user: AuthUser | null = null;
  links: NavLink[] = [];
  menuOpen = false;

  currentLang = 'en';
  languages = [
    { code: 'en', label: 'EN' },
    { code: 'es', label: 'ES' },
    { code: 'pt', label: 'PT' },
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private translate: TranslateService,
  ) {
    const saved = localStorage.getItem('tk_lang');
    this.currentLang = saved || 'en';
    this.translate.use(this.currentLang);
  }

  ngOnInit(): void {
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      this.user = user;
      this.links = this.getLinksForRole(user?.role);
    });
  }

  switchLanguage(lang: string): void {
    this.currentLang = lang;
    this.translate.use(lang);
    localStorage.setItem('tk_lang', lang);
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
      { path: '/clock', label: 'nav.clock', icon: '⏱' },
      { path: '/my-route', label: 'nav.route', icon: '📍' },
      { path: '/my-hours', label: 'nav.myHours', icon: '📊' },
      { path: '/my-timesheet', label: 'nav.timesheet', icon: '📋' },
      { path: '/time-off', label: 'nav.timeOff', icon: '📅' },
    ];

    const managerLinks: NavLink[] = [
      { path: '/manager', label: 'nav.dashboard', icon: '📊' },
      { path: '/manager/map', label: 'nav.map', icon: '📍' },
      { path: '/manager/approvals', label: 'nav.approvals', icon: '✓' },
      { path: '/manager/time-off', label: 'nav.timeOff', icon: '📅' },
      { path: '/manager/reports', label: 'nav.reports', icon: '📄' },
    ];

    switch (role) {
      case 'employee':
        return driverLinks;
      case 'manager':
        return [...managerLinks, ...driverLinks];
      case 'payroll_admin':
        return [
          { path: '/manager/reports', label: 'nav.reports', icon: '📄' },
          { path: '/manager/approvals', label: 'nav.approvals', icon: '✓' },
        ];
      case 'org_admin':
        return [
          { path: '/admin', label: 'nav.dashboard', icon: '🏢' },
          { path: '/admin/users', label: 'nav.users', icon: '👥' },
          { path: '/admin/settings', label: 'nav.settings', icon: '⚙' },
          { path: '/manager', label: 'nav.drivers', icon: '📊' },
          { path: '/manager/approvals', label: 'nav.approvals', icon: '✓' },
        ];
      default:
        return driverLinks;
    }
  }
}
