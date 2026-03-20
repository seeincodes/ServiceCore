import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/guards/auth.guard';
import { roleRedirectGuard } from './core/guards/role-redirect.guard';

export const routes: Routes = [
  {
    path: '',
    canActivate: [authGuard, roleRedirectGuard],
    children: [],
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'clock',
    loadComponent: () =>
      import('./features/driver/clock-button/clock-button.component').then(
        (m) => m.ClockButtonComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./features/profile/profile.component').then((m) => m.ProfileComponent),
    canActivate: [authGuard],
  },
  {
    path: 'my-hours',
    loadComponent: () =>
      import('./features/driver/my-hours/my-hours.component').then((m) => m.MyHoursComponent),
    canActivate: [authGuard],
  },
  {
    path: 'my-timesheet',
    loadComponent: () =>
      import('./features/driver/my-timesheet/my-timesheet.component').then(
        (m) => m.MyTimesheetComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./features/admin/dashboard/admin-dashboard.component').then(
        (m) => m.AdminDashboardComponent,
      ),
    canActivate: [authGuard, roleGuard('org_admin')],
  },
  {
    path: 'admin/users',
    loadComponent: () =>
      import('./features/admin/users/admin-users.component').then((m) => m.AdminUsersComponent),
    canActivate: [authGuard, roleGuard('org_admin')],
  },
  {
    path: 'admin/settings',
    loadComponent: () =>
      import('./features/admin/settings/admin-settings.component').then(
        (m) => m.AdminSettingsComponent,
      ),
    canActivate: [authGuard, roleGuard('org_admin')],
  },
  {
    path: 'manager',
    loadComponent: () =>
      import('./features/manager/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    canActivate: [authGuard, roleGuard('manager', 'org_admin')],
  },
  {
    path: 'manager/approvals',
    loadComponent: () =>
      import('./features/manager/approval-queue/approval-queue.component').then(
        (m) => m.ApprovalQueueComponent,
      ),
    canActivate: [authGuard, roleGuard('manager', 'org_admin')],
  },
  {
    path: 'manager/driver/:userId',
    loadComponent: () =>
      import('./features/manager/driver-detail/driver-detail.component').then(
        (m) => m.DriverDetailComponent,
      ),
    canActivate: [authGuard, roleGuard('manager', 'org_admin')],
  },
];
