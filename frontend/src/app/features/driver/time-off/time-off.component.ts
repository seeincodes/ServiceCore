import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { environment } from '../../../../environments/environment';

interface TimeOffBalance {
  total: number;
  used: number;
  available: number;
}

interface TimeOffRequest {
  id: string;
  type: string;
  start_date: string;
  end_date: string;
  hours_requested: number;
  status: string;
  notes: string;
  review_notes: string;
  created_at: string;
}

@Component({
  selector: 'app-time-off',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './time-off.component.html',
  styleUrls: ['./time-off.component.scss'],
})
export class TimeOffComponent implements OnInit {
  balances: Record<string, TimeOffBalance> = {};
  requests: TimeOffRequest[] = [];
  loading = true;
  showForm = false;
  submitting = false;
  confirmation: string | null = null;

  // Form fields
  requestType = 'pto';
  startDate = '';
  endDate = '';
  hours = 8;
  notes = '';

  types = [
    { value: 'pto', labelKey: 'timeOff.pto' },
    { value: 'sick', labelKey: 'timeOff.sick' },
    { value: 'personal', labelKey: 'timeOff.personal' },
    { value: 'bereavement', labelKey: 'timeOff.bereavement' },
    { value: 'jury_duty', labelKey: 'timeOff.juryDuty' },
  ];

  get balanceItems(): { label: string; total: number; used: number; available: number }[] {
    return ['pto', 'sick', 'personal'].map((type) => {
      const b = this.balances[type] || { total: 0, used: 0, available: 0 };
      return { label: this.typeLabel(type), total: b.total, used: b.used, available: b.available };
    });
  }

  getTypeLabel(labelKey: string): string {
    return this.translate.instant(labelKey);
  }

  constructor(
    private http: HttpClient,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.http.get<any>(`${environment.apiUrl}/time-off/balances`).subscribe({
      next: (res) => {
        this.balances = res.data.balances;
        this.http.get<any>(`${environment.apiUrl}/time-off/requests`).subscribe({
          next: (reqRes) => {
            this.requests = reqRes.data.requests;
            this.loading = false;
          },
          error: () => {
            this.loading = false;
          },
        });
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  submitRequest(): void {
    if (!this.startDate || !this.endDate || this.hours <= 0) return;
    this.submitting = true;

    this.http
      .post<any>(`${environment.apiUrl}/time-off/request`, {
        type: this.requestType,
        startDate: this.startDate,
        endDate: this.endDate,
        hoursRequested: this.hours,
        notes: this.notes,
      })
      .subscribe({
        next: () => {
          this.submitting = false;
          this.showForm = false;
          this.confirmation = 'Time-off request submitted!';
          this.resetForm();
          this.loadData();
          setTimeout(() => (this.confirmation = null), 3000);
        },
        error: (err) => {
          this.submitting = false;
          this.confirmation = err.error?.message || 'Failed to submit request';
          setTimeout(() => (this.confirmation = null), 5000);
        },
      });
  }

  cancelRequest(id: string): void {
    this.http.post(`${environment.apiUrl}/time-off/${id}/cancel`, {}).subscribe({
      next: () => this.loadData(),
    });
  }

  typeLabel(type: string): string {
    const typeMap: Record<string, string> = {
      pto: 'timeOff.pto',
      sick: 'timeOff.sick',
      personal: 'timeOff.personal',
      bereavement: 'timeOff.bereavement',
      jury_duty: 'timeOff.juryDuty',
    };
    return this.translate.instant(typeMap[type] || type);
  }

  statusClass(status: string): string {
    return status === 'approved'
      ? 'approved'
      : status === 'denied'
        ? 'denied'
        : status === 'pending'
          ? 'pending'
          : '';
  }

  onDatesChanged(): void {
    if (this.startDate && this.endDate) {
      const start = new Date(this.startDate);
      const end = new Date(this.endDate);
      let days = 0;
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (d.getDay() !== 0 && d.getDay() !== 6) days++;
      }
      this.hours = days * 8;
    }
  }

  private resetForm(): void {
    this.requestType = 'pto';
    this.startDate = '';
    this.endDate = '';
    this.hours = 8;
    this.notes = '';
  }
}
