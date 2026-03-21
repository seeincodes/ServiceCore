import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subject, takeUntil, interval } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService, AuthUser } from '../../../core/services/auth.service';
import { PreferencesService } from '../../../core/services/preferences.service';

interface NavLink {
  path: string;
  label: string;
  icon: SafeHtml;
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
  alertCount = 0;

  get isManagerOrAdmin(): boolean {
    return this.user?.role === 'manager' || this.user?.role === 'org_admin';
  }

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
    private sanitizer: DomSanitizer,
    private prefsService: PreferencesService,
    private http: HttpClient,
  ) {
    this.currentLang = this.prefsService.language;
    this.translate.use(this.currentLang);
  }

  ngOnInit(): void {
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      this.user = user;
      this.links = this.getLinksForRole(user?.role);
      if (user) {
        this.prefsService.load();
        if (this.isManagerOrAdmin) {
          this.loadAlertCount();
          // Poll every 2 minutes for new alerts
          interval(2 * 60 * 1000)
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => this.loadAlertCount());
        }
      }
    });
  }

  private loadAlertCount(): void {
    this.http.get<any>(`${environment.apiUrl}/manager/alerts`).subscribe({
      next: (res) => {
        this.alertCount = res.data?.unreadCount || 0;
      },
    });
  }

  switchLanguage(lang: string): void {
    this.currentLang = lang;
    this.translate.use(lang);
    this.prefsService.setLanguage(lang);
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

  private svg(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  private getLinksForRole(role?: string): NavLink[] {
    if (!role) return [];

    // SVG icons (Lucide-style, 18px) — sanitized for Angular innerHTML
    const s = (html: string) => this.svg(html);
    const icons = {
      clock: s(
        '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
      ),
      route: s(
        '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/></svg>',
      ),
      hours: s(
        '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>',
      ),
      timesheet: s(
        '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>',
      ),
      timeOff: s(
        '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
      ),
      dashboard: s(
        '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
      ),
      map: s(
        '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
      ),
      approvals: s(
        '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      ),
      reports: s(
        '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg>',
      ),
      building: s(
        '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>',
      ),
      users: s(
        '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
      ),
      settings: s(
        '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
      ),
    };

    const driverLinks: NavLink[] = [
      { path: '/clock', label: 'nav.clock', icon: icons.clock },
      { path: '/my-route', label: 'nav.route', icon: icons.route },
      { path: '/my-hours', label: 'nav.myHours', icon: icons.hours },
      { path: '/my-timesheet', label: 'nav.timesheet', icon: icons.timesheet },
      { path: '/time-off', label: 'nav.timeOff', icon: icons.timeOff },
    ];

    const managerLinks: NavLink[] = [
      { path: '/manager', label: 'nav.dashboard', icon: icons.dashboard },
      ...(environment.features.managerMap
        ? [{ path: '/manager/map', label: 'nav.map', icon: icons.map }]
        : []),
      { path: '/manager/approvals', label: 'nav.approvals', icon: icons.approvals },
      { path: '/manager/time-off', label: 'nav.timeOff', icon: icons.timeOff },
      { path: '/manager/reports', label: 'nav.reports', icon: icons.reports },
    ];

    switch (role) {
      case 'employee':
        return driverLinks;
      case 'manager':
        return managerLinks;
      case 'payroll_admin':
        return [
          { path: '/manager/reports', label: 'nav.reports', icon: icons.reports },
          { path: '/manager/approvals', label: 'nav.approvals', icon: icons.approvals },
        ];
      case 'org_admin':
        return [
          { path: '/admin', label: 'nav.dashboard', icon: icons.building },
          { path: '/admin/users', label: 'nav.users', icon: icons.users },
          { path: '/admin/zones', label: 'nav.zones', icon: icons.map },
          { path: '/admin/settings', label: 'nav.settings', icon: icons.settings },
          { path: '/manager', label: 'nav.drivers', icon: icons.dashboard },
          { path: '/manager/approvals', label: 'nav.approvals', icon: icons.approvals },
          { path: '/manager/time-off', label: 'nav.timeOff', icon: icons.timeOff },
          { path: '/manager/reports', label: 'nav.reports', icon: icons.reports },
        ];
      default:
        return driverLinks;
    }
  }
}
