import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { environment } from '../../../../environments/environment';

interface AttendanceRow {
  date: string;
  present: number;
  absent: number;
  total: number;
  avgHours: number;
}

interface OtDriver {
  name: string;
  totalHours: number;
  otHours: number;
}

interface OvertimeRow {
  weekEnding: string;
  totalOtHours: number;
  driversWithOt: number;
  avgOtPerDriver: number;
  drivers: OtDriver[];
}

interface DriverRow {
  driverName: string;
  totalHours: number;
  otHours: number;
  daysWorked: number;
  avgDaily: number;
}

interface ProjectRow {
  projectName: string;
  totalHours: number;
  driverCount: number;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.scss'],
})
export class ReportsComponent {
  activeTab = 'attendance';
  rangeStart = '';
  rangeEnd = '';
  rangeLabel = '7d';
  error: string | null = null;

  // Payroll
  format = 'csv';
  generating = false;
  previewData: string | null = null;
  downloadUrl: string | null = null;

  // Attendance
  attendanceData: AttendanceRow[] = [];
  attendanceLoading = false;

  // Overtime
  overtimeData: OvertimeRow[] = [];
  overtimeLoading = false;

  // Per-driver
  driverData: DriverRow[] = [];
  driverLoading = false;

  // Per-project
  projectData: ProjectRow[] = [];
  projectLoading = false;
  maxProjectHours = 0;

  reportTypes = [
    {
      value: 'attendance',
      label: 'Attendance',
      desc: 'Daily present/absent counts and average hours',
    },
    {
      value: 'overtime',
      label: 'Overtime Trends',
      desc: 'Weekly overtime hours and driver counts',
    },
    { value: 'driver', label: 'By Driver', desc: 'Hours breakdown per employee' },
    { value: 'project', label: 'By Project', desc: 'Hours breakdown per project or route' },
    {
      value: 'payroll',
      label: 'Payroll Export',
      desc: 'Download payroll report as CSV, PDF, or Excel',
    },
  ];

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {
    this.setRange(7);
  }

  get isLoading(): boolean {
    return (
      this.generating ||
      this.attendanceLoading ||
      this.overtimeLoading ||
      this.driverLoading ||
      this.projectLoading
    );
  }

  get showEmpty(): boolean {
    if (this.isLoading) return false;
    switch (this.activeTab) {
      case 'attendance':
        return this.attendanceData.length === 0 && !this.attendanceLoading;
      case 'overtime':
        return this.overtimeData.length === 0 && !this.overtimeLoading;
      case 'driver':
        return this.driverData.length === 0 && !this.driverLoading;
      case 'project':
        return this.projectData.length === 0 && !this.projectLoading;
      default:
        return false;
    }
  }

  setRange(days: number): void {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - days);
    this.rangeEnd = this.toDateString(end);
    this.rangeStart = this.toDateString(start);
    this.rangeLabel = `${days}d`;
  }

  onReportTypeChange(): void {
    this.error = null;
  }

  runReport(): void {
    this.error = null;
    switch (this.activeTab) {
      case 'payroll':
        this.generatePayroll();
        break;
      case 'attendance':
        this.loadAttendance();
        break;
      case 'overtime':
        this.loadOvertime();
        break;
      case 'driver':
        this.loadDriverData();
        break;
      case 'project':
        this.loadProjectData();
        break;
    }
  }

  // --- Payroll ---

  private generatePayroll(): void {
    this.generating = true;
    this.previewData = null;
    this.downloadUrl = null;

    const body: Record<string, string> = {
      period: 'custom',
      format: this.format,
      startDate: this.rangeStart,
      endDate: this.rangeEnd,
    };

    this.http
      .post(`${this.apiUrl}/manager/reports/generate`, body, {
        responseType: 'blob',
        observe: 'response',
      })
      .subscribe({
        next: (response) => {
          this.generating = false;
          const blob = response.body;
          if (!blob) return;

          const contentType = response.headers.get('content-type') || '';

          if (contentType.includes('application/json')) {
            blob.text().then((text) => {
              const json = JSON.parse(text);
              if (json.data?.url) {
                this.downloadUrl = json.data.url;
              }
            });
            return;
          }

          if (this.format === 'csv') {
            blob.text().then((text) => {
              this.previewData = text;
            });
          }

          this.triggerDownload(
            blob,
            `payroll-${this.rangeStart}-to-${this.rangeEnd}.${this.format}`,
          );
        },
        error: (err) => {
          this.generating = false;
          if (err.error instanceof Blob) {
            err.error.text().then((text: string) => {
              try {
                this.error = JSON.parse(text).error || 'Report generation failed';
              } catch {
                this.error = 'Report generation failed';
              }
            });
          } else {
            this.error = err.error?.error || 'Report generation failed';
          }
        },
      });
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  // --- Attendance ---

  loadAttendance(): void {
    this.attendanceLoading = true;
    const days = this.daysBetween(this.rangeStart, this.rangeEnd);
    this.http
      .get<{ data: AttendanceRow[] }>(`${this.apiUrl}/manager/reports/attendance?days=${days}`)
      .subscribe({
        next: (res) => {
          this.attendanceData = res.data || [];
          this.attendanceLoading = false;
        },
        error: () => {
          this.attendanceLoading = false;
          this.error = 'Failed to load attendance data';
        },
      });
  }

  attendancePercent(row: AttendanceRow): number {
    if (!row.total || row.total === 0) return 0;
    return Math.round((row.present / row.total) * 100);
  }

  // --- Overtime ---

  loadOvertime(): void {
    this.overtimeLoading = true;
    const weeks = Math.max(1, Math.ceil(this.daysBetween(this.rangeStart, this.rangeEnd) / 7));
    this.http
      .get<{ data: OvertimeRow[] }>(`${this.apiUrl}/manager/reports/overtime-trends?weeks=${weeks}`)
      .subscribe({
        next: (res) => {
          this.overtimeData = res.data || [];
          this.overtimeLoading = false;
        },
        error: () => {
          this.overtimeLoading = false;
          this.error = 'Failed to load overtime data';
        },
      });
  }

  // --- Per-Driver ---

  loadDriverData(): void {
    this.driverLoading = true;
    this.http
      .get<{
        data: DriverRow[];
      }>(
        `${this.apiUrl}/manager/reports/per-driver?startDate=${this.rangeStart}&endDate=${this.rangeEnd}`,
      )
      .subscribe({
        next: (res) => {
          this.driverData = (res.data || []).sort((a, b) => b.totalHours - a.totalHours);
          this.driverLoading = false;
        },
        error: () => {
          this.driverLoading = false;
          this.error = 'Failed to load driver data';
        },
      });
  }

  // --- Per-Project ---

  loadProjectData(): void {
    this.projectLoading = true;
    this.http
      .get<{
        data: ProjectRow[];
      }>(
        `${this.apiUrl}/manager/reports/per-project?startDate=${this.rangeStart}&endDate=${this.rangeEnd}`,
      )
      .subscribe({
        next: (res) => {
          this.projectData = (res.data || []).sort((a, b) => b.totalHours - a.totalHours);
          this.maxProjectHours = this.projectData.length
            ? Math.max(...this.projectData.map((p) => p.totalHours))
            : 0;
          this.projectLoading = false;
        },
        error: () => {
          this.projectLoading = false;
          this.error = 'Failed to load project data';
        },
      });
  }

  projectBarWidth(hours: number): number {
    if (!this.maxProjectHours) return 0;
    return Math.round((hours / this.maxProjectHours) * 100);
  }

  // --- Export CSV ---

  exportingCsv = false;

  exportCsv(): void {
    this.exportingCsv = true;
    this.error = null;

    const body = {
      type: this.activeTab,
      startDate: this.rangeStart,
      endDate: this.rangeEnd,
      format: 'csv',
    };

    this.http
      .post(`${this.apiUrl}/manager/reports/export`, body, {
        responseType: 'blob',
      })
      .subscribe({
        next: (blob) => {
          this.exportingCsv = false;
          this.triggerDownload(
            blob,
            `${this.activeTab}-${this.rangeStart}-to-${this.rangeEnd}.csv`,
          );
        },
        error: (err) => {
          this.exportingCsv = false;
          if (err.error instanceof Blob) {
            err.error.text().then((text: string) => {
              try {
                this.error = JSON.parse(text).error || 'Export failed';
              } catch {
                this.error = 'Export failed';
              }
            });
          } else {
            this.error = err.error?.error || 'Export failed';
          }
        },
      });
  }

  // --- Helpers ---

  private toDateString(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  private daysBetween(start: string, end: string): number {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    return Math.max(1, Math.round((e - s) / 86400000));
  }
}
