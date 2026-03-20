import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TimesheetService, TimesheetSummary } from '../../../core/services/timesheet.service';

@Component({
  selector: 'app-approval-queue',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  constructor(private timesheetService: TimesheetService) {}

  ngOnInit(): void {
    this.loadPending();
  }

  approve(ts: TimesheetSummary): void {
    this.performAction(ts.id, 'approved');
  }

  requestRevision(ts: TimesheetSummary): void {
    this.showNotesFor = ts.id;
  }

  reject(ts: TimesheetSummary): void {
    this.showNotesFor = ts.id;
  }

  submitRevisionRequest(tsId: string): void {
    this.performAction(tsId, 'revision_requested', this.rejectNotes[tsId]);
  }

  submitRejection(tsId: string): void {
    this.performAction(tsId, 'rejected', this.rejectNotes[tsId]);
  }

  cancelNotes(): void {
    this.showNotesFor = null;
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString();
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
}
