import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent implements OnInit {
  profile = { firstName: '', lastName: '', email: '', phone: '', role: '', orgName: '' };
  passwords = { currentPassword: '', newPassword: '', confirmPassword: '' };

  editingProfile = false;
  savingProfile = false;
  changingPassword = false;
  savingPassword = false;
  message: { text: string; type: 'success' | 'error' } | null = null;

  private apiUrl = `${environment.apiUrl}/auth`;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private translate: TranslateService,
    public prefsService: PreferencesService,
  ) {}

  ngOnInit(): void {
    this.loadProfile();
  }

  toggleEditProfile(): void {
    this.editingProfile = !this.editingProfile;
    this.message = null;
  }

  saveProfile(): void {
    this.savingProfile = true;
    this.message = null;

    this.http
      .put<any>(`${this.apiUrl}/profile`, {
        firstName: this.profile.firstName,
        lastName: this.profile.lastName,
        phone: this.profile.phone,
      })
      .subscribe({
        next: () => {
          this.savingProfile = false;
          this.editingProfile = false;
          this.message = { text: 'Profile updated', type: 'success' };
        },
        error: (err) => {
          this.savingProfile = false;
          this.message = { text: err.error?.error || 'Update failed', type: 'error' };
        },
      });
  }

  toggleChangePassword(): void {
    this.changingPassword = !this.changingPassword;
    this.passwords = { currentPassword: '', newPassword: '', confirmPassword: '' };
    this.message = null;
  }

  savePassword(): void {
    if (this.passwords.newPassword !== this.passwords.confirmPassword) {
      this.message = { text: 'New passwords do not match', type: 'error' };
      return;
    }

    this.savingPassword = true;
    this.message = null;

    this.http
      .put<any>(`${this.apiUrl}/password`, {
        currentPassword: this.passwords.currentPassword,
        newPassword: this.passwords.newPassword,
      })
      .subscribe({
        next: () => {
          this.savingPassword = false;
          this.changingPassword = false;
          this.passwords = { currentPassword: '', newPassword: '', confirmPassword: '' };
          this.message = { text: 'Password changed successfully', type: 'success' };
        },
        error: (err) => {
          this.savingPassword = false;
          this.message = { text: err.error?.error || 'Password change failed', type: 'error' };
        },
      });
  }

  roleLabel(role: string): string {
    const key = `profile.roles.${role}`;
    const translated = this.translate.instant(key);
    return translated !== key ? translated : role;
  }

  private loadProfile(): void {
    this.http.get<any>(`${this.apiUrl}/me`).subscribe({
      next: (res) => {
        const u = res.data.user;
        this.profile = {
          firstName: u.first_name || '',
          lastName: u.last_name || '',
          email: u.email,
          phone: u.phone || '',
          role: u.role,
          orgName: u.org_name || '',
        };
      },
    });
  }
}
