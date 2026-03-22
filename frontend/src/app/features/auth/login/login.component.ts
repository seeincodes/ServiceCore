import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslateModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  showDemoLogins = environment.showDemoLogins;
  demoPassword = environment.demoPassword;
  email = '';
  password = '';
  loading = false;
  error: string | null = null;

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {
    // Redirect if already logged in
    if (this.authService.isAuthenticated) {
      this.redirectByRole();
    }
  }

  onSubmit(): void {
    if (!this.email || !this.password || this.loading) return;

    this.loading = true;
    this.error = null;

    this.authService.login(this.email, this.password).subscribe({
      next: (res) => {
        this.loading = false;
        this.redirectByRole(res.data.user.role);
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error || 'Invalid email or password';
      },
    });
  }

  private redirectByRole(role?: string): void {
    const r = role || this.authService.currentUser?.role;
    switch (r) {
      case 'org_admin':
        this.router.navigate(['/admin']);
        break;
      case 'manager':
        this.router.navigate(['/manager']);
        break;
      case 'payroll_admin':
        this.router.navigate(['/manager/reports']);
        break;
      default:
        this.router.navigate(['/clock']);
    }
  }
}
