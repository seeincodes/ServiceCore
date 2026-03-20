import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const roleRedirectGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.currentUser;
  if (!user) {
    router.navigate(['/login']);
    return false;
  }

  switch (user.role) {
    case 'org_admin':
      router.navigate(['/admin']);
      break;
    case 'manager':
      router.navigate(['/manager']);
      break;
    case 'payroll_admin':
      router.navigate(['/manager/reports']);
      break;
    default:
      router.navigate(['/clock']);
      break;
  }

  return false;
};
