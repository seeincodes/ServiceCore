import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { environment } from '../../../../environments/environment';

interface BalanceInfo {
  total: number;
  used: number;
  available: number;
}

@Component({
  selector: 'app-manager-time-off',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './manager-time-off.component.html',
  styleUrls: ['./manager-time-off.component.scss'],
})
export class ManagerTimeOffComponent implements OnInit {
  requests: any[] = [];
  loading = true;
  tab: 'pending' | 'all' | 'balances' = 'pending';
  pendingCount = 0;
  reviewNotes: Record<string, string> = {};

  // Balance data
  employeeBalanceMap: Record<string, Record<string, BalanceInfo>> = {};
  employeeBalanceList: {
    name: string;
    pto: BalanceInfo;
    sick: BalanceInfo;
    personal: BalanceInfo;
  }[] = [];

  private typeKeys: Record<string, string> = {
    pto: 'timeOff.pto',
    sick: 'timeOff.sick',
    personal: 'timeOff.personal',
    bereavement: 'timeOff.bereavement',
    jury_duty: 'timeOff.juryDuty',
  };

  constructor(
    private http: HttpClient,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    this.loadRequests();
  }

  loadRequests(): void {
    this.loading = true;
    const params = this.tab === 'pending' ? '?status=pending' : '';
    this.http.get<any>(`${environment.apiUrl}/time-off/requests${params}`).subscribe({
      next: (res) => {
        this.requests = res.data.requests;
        this.loading = false;
        if (this.tab === 'pending') {
          this.pendingCount = this.requests.length;
          // Load balances for pending request users
          this.loadRequestUserBalances();
        } else {
          this.pendingCount = this.requests.filter((r: any) => r.status === 'pending').length;
        }
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  loadEmployeeBalances(): void {
    this.loading = true;
    this.http.get<any>(`${environment.apiUrl}/time-off/all-balances`).subscribe({
      next: (res) => {
        const defaultBal: BalanceInfo = { total: 0, used: 0, available: 0 };
        this.employeeBalanceList = (res.data.employees || []).map((emp: any) => ({
          name: emp.name,
          pto: emp.pto || defaultBal,
          sick: emp.sick || defaultBal,
          personal: emp.personal || defaultBal,
        }));
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  approve(id: string): void {
    this.http
      .post(`${environment.apiUrl}/time-off/${id}/approve`, { notes: this.reviewNotes[id] })
      .subscribe({ next: () => this.loadRequests() });
  }

  deny(id: string): void {
    this.http
      .post(`${environment.apiUrl}/time-off/${id}/deny`, { notes: this.reviewNotes[id] })
      .subscribe({ next: () => this.loadRequests() });
  }

  typeLabel(type: string): string {
    const key = this.typeKeys[type];
    return key ? this.translate.instant(key) : type;
  }

  private loadRequestUserBalances(): void {
    const userIds = [...new Set(this.requests.map((r) => r.user_id))];
    for (const userId of userIds) {
      this.http.get<any>(`${environment.apiUrl}/time-off/balances?userId=${userId}`).subscribe({
        next: (res) => {
          this.employeeBalanceMap[userId] = res.data.balances;
        },
      });
    }
  }
}
