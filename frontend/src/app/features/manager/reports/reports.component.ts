import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.scss'],
})
export class ReportsComponent {
  period = 'weekly';
  format = 'csv';
  endDate = '';
  generating = false;
  error: string | null = null;
  previewData: string | null = null;
  downloadUrl: string | null = null;

  private apiUrl = `${environment.apiUrl}/manager/reports/generate`;

  constructor(private http: HttpClient) {}

  generate(): void {
    this.generating = true;
    this.error = null;
    this.previewData = null;
    this.downloadUrl = null;

    const body: Record<string, string> = { period: this.period, format: this.format };
    if (this.endDate) body['endDate'] = this.endDate;

    this.http.post(this.apiUrl, body, { responseType: 'blob', observe: 'response' }).subscribe({
      next: (response) => {
        this.generating = false;
        const blob = response.body;
        if (!blob) return;

        const contentType = response.headers.get('content-type') || '';

        // If JSON response (S3 URL), parse it
        if (contentType.includes('application/json')) {
          blob.text().then((text) => {
            const json = JSON.parse(text);
            if (json.data?.url) {
              this.downloadUrl = json.data.url;
            }
          });
          return;
        }

        // For CSV, show preview
        if (this.format === 'csv') {
          blob.text().then((text) => {
            this.previewData = text;
          });
        }

        // Trigger download
        this.triggerDownload(blob, this.getFilename());
      },
      error: (err) => {
        this.generating = false;
        if (err.error instanceof Blob) {
          err.error.text().then((text: string) => {
            try {
              const json = JSON.parse(text);
              this.error = json.error || 'Report generation failed';
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

  get periodLabel(): string {
    const labels: Record<string, string> = {
      weekly: 'Last 7 days',
      biweekly: 'Last 14 days',
      semimonthly: 'Last 15 days',
      monthly: 'Last 30 days',
    };
    return labels[this.period] || this.period;
  }

  get formatLabel(): string {
    const labels: Record<string, string> = {
      csv: 'CSV (Spreadsheet)',
      pdf: 'PDF (Document)',
      xlsx: 'Excel (XLSX)',
    };
    return labels[this.format] || this.format;
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  private getFilename(): string {
    const date = this.endDate || new Date().toISOString().split('T')[0];
    const ext = this.format || 'csv';
    return `payroll-${this.period}-${date}.${ext}`;
  }
}
