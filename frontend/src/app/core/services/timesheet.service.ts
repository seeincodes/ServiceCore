import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface TimesheetSummary {
  id: string;
  userId: string;
  userName: string;
  weekEnding: string;
  status: string;
  hoursWorked: number;
  otHours: number;
}

interface PendingResponse {
  success: boolean;
  data: { timesheets: TimesheetSummary[] };
  timestamp: string;
}

interface ActionResponse {
  success: boolean;
  data: { status: string };
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class TimesheetService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getPendingApprovals(): Observable<PendingResponse> {
    return this.http.get<PendingResponse>(`${this.apiUrl}/manager/approvals/pending`);
  }

  approveTimesheet(
    timesheetId: string,
    action: 'approved' | 'rejected' | 'revision_requested',
    notes?: string,
  ): Observable<ActionResponse> {
    return this.http.post<ActionResponse>(`${this.apiUrl}/timesheets/${timesheetId}/approve`, {
      action,
      notes,
    });
  }

  submitTimesheet(timesheetId: string): Observable<ActionResponse> {
    return this.http.post<ActionResponse>(`${this.apiUrl}/timesheets/${timesheetId}/submit`, {});
  }

  getMyTimesheet(): Observable<{ success: boolean; data: { timesheetId: string } }> {
    return this.http.get<{ success: boolean; data: { timesheetId: string } }>(
      `${this.apiUrl}/timesheets/mine`,
    );
  }
}
