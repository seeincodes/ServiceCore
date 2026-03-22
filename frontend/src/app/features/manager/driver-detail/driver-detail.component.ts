import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { DashboardService, DriverDayEntry } from '../../../core/services/dashboard.service';
import { environment } from '../../../../environments/environment';

interface PerformanceWeek {
  weekEnding: string;
  hours: number;
  otHours: number;
  daysWorked: number;
  avgStart: string;
  lateArrivals: number;
}

interface DriverNote {
  id: string;
  text: string;
  authorName: string;
  createdAt: string;
}

@Component({
  selector: 'app-driver-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './driver-detail.component.html',
  styleUrls: ['./driver-detail.component.scss'],
})
export class DriverDetailComponent implements OnInit {
  entries: DriverDayEntry[] = [];
  userId = '';
  loading = true;
  totalHours = 0;
  selectedDate: string = '';
  editingEntryId: string | null = null;
  editClockIn = '';
  editClockOut = '';
  saving = false;
  error: string | null = null;

  // Performance
  performanceData: PerformanceWeek[] = [];
  performanceLoading = false;
  showPerformance = false;

  // Notes
  notes: DriverNote[] = [];
  notesLoading = false;
  newNoteText = '';
  addingNote = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dashboardService: DashboardService,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    this.userId = this.route.snapshot.paramMap.get('userId') || '';
    this.selectedDate = this.todayString();
    this.loadEntries();
    this.loadNotes();
  }

  goBack(): void {
    this.router.navigate(['/manager']);
  }

  formatTime(isoString: string | null): string {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  onDateChange(): void {
    this.cancelEdit();
    this.loadEntries();
  }

  startEdit(entry: DriverDayEntry): void {
    this.editingEntryId = entry.id;
    this.editClockIn = this.toDatetimeLocal(entry.clockIn);
    this.editClockOut = entry.clockOut ? this.toDatetimeLocal(entry.clockOut) : '';
  }

  cancelEdit(): void {
    this.editingEntryId = null;
    this.editClockIn = '';
    this.editClockOut = '';
    this.error = null;
  }

  saveEdit(entryId: string): void {
    this.saving = true;
    this.error = null;
    const body: any = {
      clockIn: new Date(this.editClockIn).toISOString(),
    };
    if (this.editClockOut) {
      body.clockOut = new Date(this.editClockOut).toISOString();
    }

    this.http
      .put<any>(`${environment.apiUrl}/manager/driver/${this.userId}/entries/${entryId}`, body)
      .subscribe({
        next: () => {
          this.saving = false;
          this.editingEntryId = null;
          this.loadEntries();
        },
        error: (err) => {
          this.saving = false;
          this.error = err.error?.error || 'Failed to save entry';
        },
      });
  }

  // Performance
  togglePerformance(): void {
    this.showPerformance = !this.showPerformance;
    if (this.showPerformance && this.performanceData.length === 0) {
      this.loadPerformance();
    }
  }

  private loadPerformance(): void {
    this.performanceLoading = true;
    this.http
      .get<{
        data: PerformanceWeek[];
      }>(`${environment.apiUrl}/manager/driver/${this.userId}/performance?weeks=4`)
      .subscribe({
        next: (res) => {
          this.performanceData = res.data || [];
          this.performanceLoading = false;
        },
        error: () => {
          this.performanceLoading = false;
        },
      });
  }

  // Notes
  loadNotes(): void {
    this.notesLoading = true;
    this.http
      .get<{ data: DriverNote[] }>(`${environment.apiUrl}/manager/driver/${this.userId}/notes`)
      .subscribe({
        next: (res) => {
          this.notes = res.data || [];
          this.notesLoading = false;
        },
        error: () => {
          this.notesLoading = false;
        },
      });
  }

  addNote(): void {
    if (!this.newNoteText.trim()) return;
    this.addingNote = true;
    this.http
      .post<{ data: DriverNote }>(`${environment.apiUrl}/manager/driver/${this.userId}/notes`, {
        text: this.newNoteText,
      })
      .subscribe({
        next: (res) => {
          if (res.data) {
            this.notes.unshift(res.data);
          }
          this.newNoteText = '';
          this.addingNote = false;
        },
        error: () => {
          this.addingNote = false;
        },
      });
  }

  deleteNote(noteId: string): void {
    this.http
      .delete(`${environment.apiUrl}/manager/driver/${this.userId}/notes/${noteId}`)
      .subscribe({
        next: () => {
          this.notes = this.notes.filter((n) => n.id !== noteId);
        },
      });
  }

  formatNoteDate(iso: string): string {
    return new Date(iso).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  sourceClass(source: string): string {
    switch (source) {
      case 'mobile':
        return 'badge-mobile';
      case 'web':
        return 'badge-web';
      case 'admin':
      case 'manager':
        return 'badge-admin';
      default:
        return 'badge-default';
    }
  }

  private todayString(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private toDatetimeLocal(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  private loadEntries(): void {
    this.loading = true;
    this.dashboardService.getDriverDay(this.userId, this.selectedDate).subscribe({
      next: (res) => {
        this.entries = res.data.entries;
        this.totalHours = this.entries.reduce((sum, e) => sum + (e.hours || 0), 0);
        this.totalHours = Math.round(this.totalHours * 100) / 100;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }
}
