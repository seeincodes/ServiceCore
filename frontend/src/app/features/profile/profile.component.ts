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
  showPinSetup = false;
  savingPin = false;
  pinSet = false;
  newPin = '';
  message: { text: string; type: 'success' | 'error' } | null = null;
  currentLang = 'en';

  // Org settings (org_admin only)
  orgSettings = {
    branding: { logo: '', primaryColor: '#1a73e8', secondaryColor: '' },
    config: { ot_rules: 'federal', approval_required: true, sms_enabled: false, qb_enabled: false },
  };
  savingOrgSettings = false;

  private apiUrl = `${environment.apiUrl}/auth`;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private translate: TranslateService,
    public prefsService: PreferencesService,
  ) {}

  get isAdmin(): boolean {
    return this.profile.role === 'org_admin';
  }

  ngOnInit(): void {
    this.currentLang = this.prefsService.language;
    this.loadProfile();
    this.checkPinStatus();
  }

  switchLanguage(lang: string): void {
    this.currentLang = lang;
    this.translate.use(lang);
    this.prefsService.setLanguage(lang);
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

  saveOrgSettings(): void {
    this.savingOrgSettings = true;
    this.message = null;

    this.http
      .put<any>(`${environment.apiUrl}/admin/settings`, {
        branding: this.orgSettings.branding,
        config: this.orgSettings.config,
      })
      .subscribe({
        next: () => {
          this.savingOrgSettings = false;
          this.message = { text: 'Organization settings saved', type: 'success' };
        },
        error: (err) => {
          this.savingOrgSettings = false;
          this.message = { text: err.error?.error || 'Save failed', type: 'error' };
        },
      });
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
        if (u.role === 'org_admin') {
          this.loadOrgSettings();
        }
      },
    });
  }

  private loadOrgSettings(): void {
    this.http.get<any>(`${environment.apiUrl}/admin/settings`).subscribe({
      next: (res) => {
        this.orgSettings.branding = { ...this.orgSettings.branding, ...res.data.branding };
        this.orgSettings.config = { ...this.orgSettings.config, ...res.data.config };
      },
    });
  }

  private checkPinStatus(): void {
    this.http.get<any>(`${this.apiUrl}/pin/status`).subscribe({
      next: (res) => {
        this.pinSet = res.data?.pinSet || false;
      },
    });
  }

  savePin(): void {
    if (this.newPin.length !== 4) return;
    this.savingPin = true;
    this.http.post<any>(`${this.apiUrl}/pin/set`, { pin: this.newPin }).subscribe({
      next: () => {
        this.savingPin = false;
        this.showPinSetup = false;
        this.pinSet = true;
        this.newPin = '';
        this.message = { text: 'PIN set successfully', type: 'success' };
        setTimeout(() => (this.message = null), 3000);
      },
      error: (err) => {
        this.savingPin = false;
        this.message = { text: err.error?.error || 'Failed to set PIN', type: 'error' };
      },
    });
  }
}
