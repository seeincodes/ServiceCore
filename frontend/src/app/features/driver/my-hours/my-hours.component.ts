import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
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

@Component({
  selector: 'app-my-hours',
  standalone: true,
  imports: [CommonModule, TranslateModule, HoursDisplayPipe],
  templateUrl: './my-hours.component.html',
  styleUrls: ['./my-hours.component.scss'],
})
export class MyHoursComponent implements OnInit {
  week: WeekData | null = null;
  loading = true;
  weekOffset = 0;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadWeek();
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

  formatTime(iso: string | null): string {
    if (!iso) return '-';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
}
