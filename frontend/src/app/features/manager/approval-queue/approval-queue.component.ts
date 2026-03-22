import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
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

interface BalanceInfo {
  total: number;
  used: number;
  available: number;
}

@Component({
  selector: 'app-approval-queue',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './approval-queue.component.html',
  styleUrls: ['./approval-queue.component.scss'],
})
export class ApprovalQueueComponent implements OnInit {
  // Main tab
  mainTab: 'timesheets' | 'timeoff' | 'edits' = 'timesheets';

  timesheets: TimesheetSummary[] = [];
  loading = true;
  actionInProgress: string | null = null;
  rejectNotes: Record<string, string> = {};
  showNotesFor: string | null = null;
  message: { text: string; type: 'success' | 'error' } | null = null;

  // Bulk selection
  selectedIds = new Set<string>();
  bulkInProgress = false;

  // Revise mode
  reviseTimesheetId: string | null = null;
  reviseEntries: ClockEntry[] = [];
  reviseLoading = false;
  reviseUserId: string | null = null;

  // Time-off data
  timeOffRequests: any[] = [];
  timeOffLoading = false;
  timeOffTab: 'pending' | 'all' | 'balances' = 'pending';
  pendingTimeOffCount = 0;
  timeOffReviewNotes: Record<string, string> = {};
  employeeBalanceMap: Record<string, Record<string, BalanceInfo>> = {};
  employeeBalanceList: {
    name: string;
    pto: BalanceInfo;
    sick: BalanceInfo;
    personal: BalanceInfo;
  }[] = [];

  private timeOffLoaded = false;

  // Time edit requests
  editRequests: any[] = [];
  editRequestsLoading = false;
  pendingEditCount = 0;
  editReviewNotes: Record<string, string> = {};
  private editsLoaded = false;

  private typeKeys: Record<string, string> = {
    pto: 'timeOff.pto',
    sick: 'timeOff.sick',
    personal: 'timeOff.personal',
    bereavement: 'timeOff.bereavement',
    jury_duty: 'timeOff.juryDuty',
  };

  constructor(
    private timesheetService: TimesheetService,
    private http: HttpClient,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    this.loadPending();
    // Pre-load pending count for time-off badge
    this.http.get<any>(`${environment.apiUrl}/time-off/requests?status=pending`).subscribe({
      next: (res) => {
        this.pendingTimeOffCount = (res.data?.requests || []).length;
      },
    });
    // Pre-load pending count for edit requests badge
    this.http.get<any>(`${environment.apiUrl}/manager/approvals/edit-requests`).subscribe({
      next: (res) => {
        this.pendingEditCount = (res.data?.requests || []).length;
      },
    });
  }

  switchMainTab(tab: 'timesheets' | 'timeoff' | 'edits'): void {
    this.mainTab = tab;
    if (tab === 'timeoff' && !this.timeOffLoaded) {
      this.timeOffLoaded = true;
      this.loadTimeOffRequests();
    }
    if (tab === 'edits' && !this.editsLoaded) {
      this.editsLoaded = true;
      this.loadEditRequests();
    }
  }

  // ---- Time-off methods ----

  loadTimeOffRequests(): void {
    this.timeOffLoading = true;
    const params = this.timeOffTab === 'pending' ? '?status=pending' : '';
    this.http.get<any>(`${environment.apiUrl}/time-off/requests${params}`).subscribe({
      next: (res) => {
        this.timeOffRequests = res.data.requests;
        this.timeOffLoading = false;
        if (this.timeOffTab === 'pending') {
          this.pendingTimeOffCount = this.timeOffRequests.length;
          this.loadRequestUserBalances();
        } else {
          this.pendingTimeOffCount = this.timeOffRequests.filter(
            (r: any) => r.status === 'pending',
          ).length;
        }
      },
      error: () => {
        this.timeOffLoading = false;
      },
    });
  }

  loadEmployeeBalances(): void {
    this.timeOffLoading = true;
    this.http.get<any>(`${environment.apiUrl}/time-off/all-balances`).subscribe({
      next: (res) => {
        const defaultBal: BalanceInfo = { total: 0, used: 0, available: 0 };
        this.employeeBalanceList = (res.data.employees || []).map((emp: any) => ({
          name: emp.name,
          pto: emp.pto || defaultBal,
          sick: emp.sick || defaultBal,
          personal: emp.personal || defaultBal,
        }));
        this.timeOffLoading = false;
      },
      error: () => {
        this.timeOffLoading = false;
      },
    });
  }

  approveTimeOff(id: string): void {
    this.http
      .post(`${environment.apiUrl}/time-off/${id}/approve`, { notes: this.timeOffReviewNotes[id] })
      .subscribe({ next: () => this.loadTimeOffRequests() });
  }

  denyTimeOff(id: string): void {
    this.http
      .post(`${environment.apiUrl}/time-off/${id}/deny`, { notes: this.timeOffReviewNotes[id] })
      .subscribe({ next: () => this.loadTimeOffRequests() });
  }

  timeOffTypeLabel(type: string): string {
    const key = this.typeKeys[type];
    return key ? this.translate.instant(key) : type;
  }

  private loadRequestUserBalances(): void {
    const userIds = [...new Set(this.timeOffRequests.map((r) => r.user_id))];
    for (const userId of userIds) {
      this.http.get<any>(`${environment.apiUrl}/time-off/balances?userId=${userId}`).subscribe({
        next: (res) => {
          this.employeeBalanceMap[userId] = res.data.balances;
        },
      });
    }
  }

  // ---- Timesheet methods (existing) ----

  // Bulk selection methods
  toggleSelect(tsId: string): void {
    if (this.selectedIds.has(tsId)) {
      this.selectedIds.delete(tsId);
    } else {
      this.selectedIds.add(tsId);
    }
  }

  toggleSelectAll(): void {
    if (this.selectedIds.size === this.timesheets.length) {
      this.selectedIds.clear();
    } else {
      this.timesheets.forEach((ts) => this.selectedIds.add(ts.id));
    }
  }

  get allSelected(): boolean {
    return this.timesheets.length > 0 && this.selectedIds.size === this.timesheets.length;
  }

  bulkApprove(): void {
    if (this.selectedIds.size === 0) return;
    this.bulkInProgress = true;
    const ids = Array.from(this.selectedIds);
    this.http
      .post<any>(`${environment.apiUrl}/timesheets/bulk-approve`, { ids, action: 'approved' })
      .subscribe({
        next: () => {
          this.timesheets = this.timesheets.filter((t) => !this.selectedIds.has(t.id));
          this.message = { text: `${ids.length} timesheet(s) approved`, type: 'success' };
          this.selectedIds.clear();
          this.bulkInProgress = false;
        },
        error: (err) => {
          this.message = { text: err.error?.error || 'Bulk approve failed', type: 'error' };
          this.bulkInProgress = false;
        },
      });
  }

  bulkReject(): void {
    if (this.selectedIds.size === 0) return;
    this.bulkInProgress = true;
    const ids = Array.from(this.selectedIds);
    this.http
      .post<any>(`${environment.apiUrl}/timesheets/bulk-approve`, { ids, action: 'rejected' })
      .subscribe({
        next: () => {
          this.timesheets = this.timesheets.filter((t) => !this.selectedIds.has(t.id));
          this.message = { text: `${ids.length} timesheet(s) rejected`, type: 'success' };
          this.selectedIds.clear();
          this.bulkInProgress = false;
        },
        error: (err) => {
          this.message = { text: err.error?.error || 'Bulk reject failed', type: 'error' };
          this.bulkInProgress = false;
        },
      });
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

  // ---- Time Edit Request methods ----

  loadEditRequests(): void {
    this.editRequestsLoading = true;
    this.http.get<any>(`${environment.apiUrl}/manager/approvals/edit-requests`).subscribe({
      next: (res) => {
        this.editRequests = res.data.requests || [];
        this.pendingEditCount = this.editRequests.length;
        this.editRequestsLoading = false;
      },
      error: () => {
        this.editRequestsLoading = false;
      },
    });
  }

  approveEditRequest(id: string): void {
    this.http
      .post(`${environment.apiUrl}/manager/approvals/edit-requests/${id}/review`, {
        action: 'approved',
        notes: this.editReviewNotes[id] || '',
      })
      .subscribe({
        next: () => {
          this.editRequests = this.editRequests.filter((r: any) => r.id !== id);
          this.pendingEditCount = this.editRequests.length;
          this.message = { text: 'Edit request approved — entry updated', type: 'success' };
        },
        error: (err) => {
          this.message = { text: err.error?.error || 'Approve failed', type: 'error' };
        },
      });
  }

  rejectEditRequest(id: string): void {
    this.http
      .post(`${environment.apiUrl}/manager/approvals/edit-requests/${id}/review`, {
        action: 'rejected',
        notes: this.editReviewNotes[id] || '',
      })
      .subscribe({
        next: () => {
          this.editRequests = this.editRequests.filter((r: any) => r.id !== id);
          this.pendingEditCount = this.editRequests.length;
          this.message = { text: 'Edit request rejected', type: 'success' };
        },
        error: (err) => {
          this.message = { text: err.error?.error || 'Reject failed', type: 'error' };
        },
      });
  }

  formatEditTime(iso: string): string {
    return new Date(iso).toLocaleString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private toDatetimeLocal(iso: string): string {
    const d = new Date(iso);
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  }
}
