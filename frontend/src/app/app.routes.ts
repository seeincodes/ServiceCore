import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'clock',
    pathMatch: 'full',
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
