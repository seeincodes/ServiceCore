import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="auth-container">
      <div class="auth-card">
        <h1>Set New Password</h1>

        <div class="message success" *ngIf="success">
          {{ successMessage }}
          <a routerLink="/login" class="login-link">Go to login</a>
        </div>
        <div class="message error" *ngIf="error">
          {{ error }}
        </div>

        <div class="invalid" *ngIf="!token">
          <p>Invalid reset link. Please request a new one.</p>
          <a routerLink="/forgot-password" class="back-link">Request new reset link</a>
        </div>

        <form (ngSubmit)="submit()" *ngIf="token && !success">
          <div class="form-group">
            <label>New Password</label>
            <input
              type="password"
              [(ngModel)]="newPassword"
              name="newPassword"
              required
              minlength="8"
              placeholder="At least 8 characters"
            />
          </div>
          <div class="form-group">
            <label>Confirm Password</label>
            <input
              type="password"
              [(ngModel)]="confirmPassword"
              name="confirmPassword"
              required
              placeholder="Re-enter password"
            />
          </div>
          <button
            type="submit"
            class="submit-btn"
            [disabled]="loading || !newPassword || !confirmPassword"
          >
            {{ loading ? 'Resetting...' : 'Reset Password' }}
          </button>
        </form>
      </div>
    </div>
  `,
  styleUrls: ['./reset-password.component.scss'],
})
export class ResetPasswordComponent implements OnInit {
  token: string | null = null;
  newPassword = '';
  confirmPassword = '';
  loading = false;
  success = false;
  successMessage = '';
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token');
  }

  submit(): void {
    if (this.newPassword !== this.confirmPassword) {
      this.error = 'Passwords do not match';
      return;
    }

    this.loading = true;
    this.error = null;

    this.http
      .post<any>(`${environment.apiUrl}/auth/reset-password`, {
        token: this.token,
        newPassword: this.newPassword,
      })
      .subscribe({
        next: (res) => {
          this.loading = false;
          this.success = true;
          this.successMessage = res.data.message;
        },
        error: (err) => {
          this.loading = false;
          this.error = err.error?.error || 'Reset failed. The link may have expired.';
        },
      });
  }
}
