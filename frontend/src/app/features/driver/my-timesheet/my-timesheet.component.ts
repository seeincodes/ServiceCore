import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { environment } from '../../../../environments/environment';
import { HoursDisplayPipe } from '../../../shared/pipes/hours.pipe';

interface TimesheetHistory {
  id: string;
  weekEnding: string;
  status: string;
  hoursWorked: number;
  otHours: number;
}

interface CurrentTimesheet {
  id: string;
  status: string;
  weekEnding: string;
  hoursWorked: number;
  otHours: number;
}

@Component({
  selector: 'app-my-timesheet',
  standalone: true,
  imports: [CommonModule, TranslateModule, HoursDisplayPipe],
  templateUrl: './my-timesheet.component.html',
  styleUrls: ['./my-timesheet.component.scss'],
})
export class MyTimesheetComponent implements OnInit {
  current: CurrentTimesheet | null = null;
  history: TimesheetHistory[] = [];
  loading = true;
  submitting = false;
  message: { text: string; type: 'success' | 'error' } | null = null;

  private apiUrl = `${environment.apiUrl}/timesheets`;

  constructor(
    private http: HttpClient,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  submitTimesheet(): void {
    if (!this.current || this.submitting) return;
    this.submitting = true;
    this.message = null;

    this.http.post<any>(`${this.apiUrl}/${this.current.id}/submit`, {}).subscribe({
      next: () => {
        if (this.current) this.current.status = 'submitted';
        this.submitting = false;
        this.message = { text: 'Timesheet submitted for approval', type: 'success' };
      },
      error: (err) => {
        this.submitting = false;
        this.message = { text: err.error?.error || 'Submit failed', type: 'error' };
      },
    });
  }

  get canSubmit(): boolean {
    return this.current?.status === 'draft';
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString();
  }

  statusLabel(status: string): string {
    return this.translate.instant(`timesheet.status.${status}`) || status;
  }

  private loadData(): void {
    // Load current week data
    this.http.get<{ success: boolean; data: any }>(`${this.apiUrl}/my-entries`).subscribe({
      next: (res) => {
        this.current = {
          id: res.data.timesheet.id,
          status: res.data.timesheet.status,
          weekEnding: res.data.timesheet.weekEnding,
          hoursWorked: res.data.weekTotal,
          otHours: res.data.otHours,
        };
      },
    });

    // Load history
    this.http
      .get<{ success: boolean; data: { timesheets: TimesheetHistory[] } }>(`${this.apiUrl}/history`)
      .subscribe({
        next: (res) => {
          this.history = res.data.timesheets;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        },
      });
  }
}
