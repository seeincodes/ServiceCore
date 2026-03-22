import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { environment } from '../../../../environments/environment';
import { HoursDisplayPipe } from '../../../shared/pipes/hours.pipe';

interface DayEntry {
  id: string;
  clockIn: string;
  clockOut: string | null;
  hours: number | null;
  routeId: string | null;
  source: string;
}

interface DaySummary {
  date: string;
  dayName: string;
  entries: DayEntry[];
  totalHours: number;
}

interface WeekData {
  weekStart: string;
  weekEnd: string;
  days: DaySummary[];
  weekTotal: number;
  otHours: number;
  timesheet: { id: string; status: string; weekEnding: string };
}

interface EditRequest {
  id: string;
  type: 'add' | 'edit';
  clockEntryId: string | null;
  proposedClockIn: string;
  proposedClockOut: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewNotes: string | null;
  createdAt: string;
}

interface Project {
  id: string;
  code: string;
  name: string;
}

@Component({
  selector: 'app-my-hours',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, HoursDisplayPipe],
  templateUrl: './my-hours.component.html',
  styleUrls: ['./my-hours.component.scss'],
})
export class MyHoursComponent implements OnInit {
  week: WeekData | null = null;
  loading = true;
  weekOffset = 0;

  // Edit request form
  showEditForm = false;
  editFormType: 'add' | 'edit' = 'add';
  editEntryId: string | null = null;
  editClockIn = '';
  editClockOut = '';
  editProjectId = '';
  editReason = '';
  editSubmitting = false;
  editMessage: { text: string; type: 'success' | 'error' } | null = null;

  // My pending requests
  myRequests: EditRequest[] = [];

  // Projects
  projects: Project[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadWeek();
    this.loadMyRequests();
    this.loadProjects();
  }

  previousWeek(): void {
    this.weekOffset++;
    this.loadWeek();
  }

  nextWeek(): void {
    if (this.weekOffset > 0) {
      this.weekOffset--;
      this.loadWeek();
    }
  }

  get isCurrentWeek(): boolean {
    return this.weekOffset === 0;
  }

  get otWarning(): string | null {
    if (!this.week) return null;
    const pipe = new HoursDisplayPipe();
    const total = pipe.transform(this.week.weekTotal);
    const ot = pipe.transform(this.week.otHours);
    if (this.week.weekTotal >= 45) return `${ot} overtime — exceeded threshold`;
    if (this.week.weekTotal >= 40) return `${ot} overtime — at threshold`;
    if (this.week.weekTotal >= 38) return `Approaching overtime: ${total} of 40h`;
    return null;
  }

  get otWarningLevel(): string {
    if (!this.week) return '';
    if (this.week.weekTotal >= 45) return 'exceeded';
    if (this.week.weekTotal >= 40) return 'threshold';
    if (this.week.weekTotal >= 38) return 'approaching';
    return '';
  }

  get pendingRequests(): EditRequest[] {
    return this.myRequests.filter((r) => r.status === 'pending');
  }

  formatTime(iso: string | null): string {
    if (!iso) return '-';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // ---- Edit Request Actions ----

  openAddEntry(date?: string): void {
    this.editFormType = 'add';
    this.editEntryId = null;
    this.editReason = '';
    this.editProjectId = '';
    this.editMessage = null;

    // Default to the selected date at 7am-3pm
    const d = date || new Date().toISOString().split('T')[0];
    this.editClockIn = `${d}T07:00`;
    this.editClockOut = `${d}T15:00`;
    this.showEditForm = true;
  }

  openEditEntry(entry: DayEntry): void {
    this.editFormType = 'edit';
    this.editEntryId = entry.id;
    this.editReason = '';
    this.editProjectId = '';
    this.editMessage = null;

    // Pre-fill with current times
    this.editClockIn = this.toLocalDatetime(entry.clockIn);
    this.editClockOut = entry.clockOut ? this.toLocalDatetime(entry.clockOut) : '';
    this.showEditForm = true;
  }

  cancelEdit(): void {
    this.showEditForm = false;
    this.editMessage = null;
  }

  submitEditRequest(): void {
    if (!this.editReason.trim()) {
      this.editMessage = { text: 'Please provide a reason for this change', type: 'error' };
      return;
    }
    if (!this.editClockIn || !this.editClockOut) {
      this.editMessage = { text: 'Both clock in and clock out times are required', type: 'error' };
      return;
    }

    this.editSubmitting = true;
    this.http
      .post<any>(`${environment.apiUrl}/timesheets/edit-requests`, {
        type: this.editFormType,
        clockEntryId: this.editEntryId || undefined,
        proposedClockIn: new Date(this.editClockIn).toISOString(),
        proposedClockOut: new Date(this.editClockOut).toISOString(),
        projectId: this.editProjectId || undefined,
        reason: this.editReason,
      })
      .subscribe({
        next: () => {
          this.editSubmitting = false;
          this.showEditForm = false;
          this.editMessage = null;
          this.loadMyRequests();
        },
        error: (err) => {
          this.editSubmitting = false;
          this.editMessage = {
            text: err.error?.error || 'Failed to submit request',
            type: 'error',
          };
        },
      });
  }

  private toLocalDatetime(iso: string): string {
    const d = new Date(iso);
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  }

  private loadWeek(): void {
    this.loading = true;
    this.http
      .get<{
        success: boolean;
        data: WeekData;
      }>(`${environment.apiUrl}/timesheets/my-entries?weekOffset=${this.weekOffset}`)
      .subscribe({
        next: (res) => {
          this.week = res.data;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        },
      });
  }

  private loadMyRequests(): void {
    this.http
      .get<{
        success: boolean;
        data: { requests: EditRequest[] };
      }>(`${environment.apiUrl}/timesheets/edit-requests`)
      .subscribe({
        next: (res) => {
          this.myRequests = res.data.requests;
        },
      });
  }

  private loadProjects(): void {
    this.http.get<any>(`${environment.apiUrl}/admin/projects`).subscribe({
      next: (res) => {
        this.projects = (res.data.projects || []).filter((p: any) => p.is_active);
      },
    });
  }
}
