import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

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
];
