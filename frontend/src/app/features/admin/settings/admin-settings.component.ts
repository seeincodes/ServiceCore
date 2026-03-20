import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-settings.component.html',
  styleUrls: ['./admin-settings.component.scss'],
})
export class AdminSettingsComponent implements OnInit {
  orgName = '';
  branding = { logo: '', primaryColor: '#1a73e8', secondaryColor: '' };
  config = { ot_rules: 'federal', approval_required: true, sms_enabled: false, qb_enabled: false };
  saving = false;
  message: { text: string; type: 'success' | 'error' } | null = null;

  private apiUrl = `${environment.apiUrl}/admin`;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<any>(`${this.apiUrl}/settings`).subscribe({
      next: (res) => {
        this.orgName = res.data.name;
        this.branding = { ...this.branding, ...res.data.branding };
        this.config = { ...this.config, ...res.data.config };
      },
    });
  }

  save(): void {
    this.saving = true;
    this.message = null;

    this.http
      .put<any>(`${this.apiUrl}/settings`, {
        branding: this.branding,
        config: this.config,
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.message = { text: 'Settings saved', type: 'success' };
        },
        error: (err) => {
          this.saving = false;
          this.message = { text: err.error?.error || 'Save failed', type: 'error' };
        },
      });
  }
}
