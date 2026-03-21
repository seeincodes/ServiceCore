import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="auth-container">
      <div class="auth-card">
        <h1>Reset Password</h1>
        <p class="subtitle">Enter your email and we'll send you a reset link.</p>

        <div class="message success" *ngIf="sent">
          {{ message }}
        </div>
        <div class="message error" *ngIf="error">
          {{ error }}
        </div>

        <form (ngSubmit)="submit()" *ngIf="!sent">
          <div class="form-group">
            <label for="email">Email</label>
            <input
              id="email"
              type="email"
              [(ngModel)]="email"
              name="email"
              placeholder="your@email.com"
              required
            />
          </div>
          <button type="submit" class="submit-btn" [disabled]="loading || !email">
            {{ loading ? 'Sending...' : 'Send Reset Link' }}
          </button>
        </form>

        <a routerLink="/login" class="back-link">&larr; Back to login</a>
      </div>
    </div>
  `,
  styleUrls: ['./forgot-password.component.scss'],
})
export class ForgotPasswordComponent {
  email = '';
  loading = false;
  sent = false;
  message = '';
  error: string | null = null;

  constructor(private http: HttpClient) {}

  submit(): void {
    this.loading = true;
    this.error = null;

    this.http
      .post<any>(`${environment.apiUrl}/auth/forgot-password`, { email: this.email })
      .subscribe({
        next: (res) => {
          this.loading = false;
          this.sent = true;
          this.message = res.data.message;
        },
        error: (err) => {
          this.loading = false;
          this.error = err.error?.error || 'Something went wrong';
        },
      });
  }
}
