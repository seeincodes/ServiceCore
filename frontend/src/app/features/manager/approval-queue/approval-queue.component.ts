import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { TimesheetService, TimesheetSummary } from '../../../core/services/timesheet.service';
import { environment } from '../../../../environments/environment';

interface ClockEntry {
  id: string;
  clockIn: string;
  clockOut: string | null;
  hours: number | null;
  routeId: string | null;
  projectId: string | null;
  source: string;
  // Edit state
  editing?: boolean;
  editClockIn?: string;
  editClockOut?: string;
  saving?: boolean;
}

@Component({
  selector: 'app-approval-queue',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './approval-queue.component.html',
  styleUrls: ['./approval-queue.component.scss'],
})
export class ApprovalQueueComponent implements OnInit {
  timesheets: TimesheetSummary[] = [];
  loading = true;
  actionInProgress: string | null = null;
  rejectNotes: Record<string, string> = {};
  showNotesFor: string | null = null;
  message: { text: string; type: 'success' | 'error' } | null = null;

  // Revise mode
  reviseTimesheetId: string | null = null;
  reviseEntries: ClockEntry[] = [];
  reviseLoading = false;
  reviseUserId: string | null = null;

  constructor(
    private timesheetService: TimesheetService,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    this.loadPending();
  }

  approve(ts: TimesheetSummary): void {
    this.performAction(ts.id, 'approved');
  }

  openRevise(ts: TimesheetSummary): void {
    if (this.reviseTimesheetId === ts.id) {
      this.reviseTimesheetId = null;
      this.reviseEntries = [];
      return;
    }
    this.reviseTimesheetId = ts.id;
    this.reviseUserId = ts.userId;
    this.reviseLoading = true;
    this.reviseEntries = [];

    // Load clock entries for the week ending date
    // We need entries from Mon-Sun of that week
    const weekEnd = new Date(ts.weekEnding);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 6);

    // Load each day's entries
    this.loadWeekEntries(ts.userId, weekStart, weekEnd);
  }

  reject(ts: TimesheetSummary): void {
    this.showNotesFor = ts.id;
  }

  submitRejection(tsId: string): void {
    this.performAction(tsId, 'rejected', this.rejectNotes[tsId]);
  }

  cancelNotes(): void {
    this.showNotesFor = null;
  }

  // Entry editing
  startEdit(entry: ClockEntry): void {
    entry.editing = true;
    entry.editClockIn = this.toDatetimeLocal(entry.clockIn);
    entry.editClockOut = entry.clockOut ? this.toDatetimeLocal(entry.clockOut) : '';
  }

  cancelEdit(entry: ClockEntry): void {
    entry.editing = false;
  }

  saveEdit(entry: ClockEntry): void {
    if (!this.reviseUserId) return;
    entry.saving = true;

    const body: Record<string, string> = {};
    if (entry.editClockIn) body['clockIn'] = new Date(entry.editClockIn).toISOString();
    if (entry.editClockOut) body['clockOut'] = new Date(entry.editClockOut).toISOString();

    this.http
      .put<any>(
        `${environment.apiUrl}/manager/driver/${this.reviseUserId}/entries/${entry.id}`,
        body,
      )
      .subscribe({
        next: () => {
          // Update local state
          if (entry.editClockIn) entry.clockIn = new Date(entry.editClockIn).toISOString();
          if (entry.editClockOut) entry.clockOut = new Date(entry.editClockOut).toISOString();
          if (entry.clockIn && entry.clockOut) {
            entry.hours =
              Math.round(
                ((new Date(entry.clockOut).getTime() - new Date(entry.clockIn).getTime()) /
                  3600000) *
                  100,
              ) / 100;
          }
          entry.editing = false;
          entry.saving = false;
          this.message = { text: 'Entry updated', type: 'success' };
          this.recalcTimesheetHours();
        },
        error: (err) => {
          entry.saving = false;
          this.message = { text: err.error?.error || 'Update failed', type: 'error' };
        },
      });
  }

  approveAfterRevise(): void {
    if (!this.reviseTimesheetId) return;
    this.performAction(this.reviseTimesheetId, 'approved', 'Revised and approved by manager');
  }

  formatTime(iso: string | null): string {
    if (!iso) return '-';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString();
  }

  formatDay(iso: string): string {
    return new Date(iso).toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  get reviseTotalHours(): number {
    return Math.round(this.reviseEntries.reduce((sum, e) => sum + (e.hours || 0), 0) * 100) / 100;
  }

  private recalcTimesheetHours(): void {
    // Update the timesheet summary to reflect edited hours
    const ts = this.timesheets.find((t) => t.id === this.reviseTimesheetId);
    if (ts) {
      ts.hoursWorked = this.reviseTotalHours;
      ts.otHours = Math.max(0, Math.round((ts.hoursWorked - 40) * 100) / 100);
    }
  }

  private performAction(
    tsId: string,
    action: 'approved' | 'rejected' | 'revision_requested',
    notes?: string,
  ): void {
    this.actionInProgress = tsId;
    this.timesheetService.approveTimesheet(tsId, action, notes).subscribe({
      next: () => {
        this.timesheets = this.timesheets.filter((t) => t.id !== tsId);
        this.showNotesFor = null;
        this.actionInProgress = null;
        this.reviseTimesheetId = null;
        this.reviseEntries = [];
        this.message = {
          text: `Timesheet ${action.replace('_', ' ')} successfully`,
          type: 'success',
        };
      },
      error: (err) => {
        this.actionInProgress = null;
        this.message = { text: err.error?.error || 'Action failed', type: 'error' };
      },
    });
  }

  private loadPending(): void {
    this.timesheetService.getPendingApprovals().subscribe({
      next: (res) => {
        this.timesheets = res.data.timesheets;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  private loadWeekEntries(userId: string, start: Date, end: Date): void {
    // Load entries for each day in the range
    const days: Date[] = [];
    const current = new Date(start);
    while (current <= end) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    let completed = 0;
    const allEntries: ClockEntry[] = [];

    for (const day of days) {
      const dateStr = day.toISOString().split('T')[0];
      this.http
        .get<any>(`${environment.apiUrl}/manager/driver/${userId}/day?date=${dateStr}`)
        .subscribe({
          next: (res) => {
            const entries = (res.data?.entries || []).map((e: any) => ({
              ...e,
              editing: false,
              saving: false,
            }));
            allEntries.push(...entries);
            completed++;
            if (completed === days.length) {
              // Sort by clockIn
              this.reviseEntries = allEntries.sort(
                (a, b) => new Date(a.clockIn).getTime() - new Date(b.clockIn).getTime(),
              );
              this.reviseLoading = false;
            }
          },
          error: () => {
            completed++;
            if (completed === days.length) {
              this.reviseEntries = allEntries.sort(
                (a, b) => new Date(a.clockIn).getTime() - new Date(b.clockIn).getTime(),
              );
              this.reviseLoading = false;
            }
          },
        });
    }
  }

  private toDatetimeLocal(iso: string): string {
    const d = new Date(iso);
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  }
}
