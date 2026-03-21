import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ClockStatus {
  clockedIn: boolean;
  entryId?: string;
  clockInTime?: string;
  elapsedHours?: number;
  todayHours?: number;
  routeId?: string;
  projectId?: string;
}

export interface ClockInResponse {
  success: boolean;
  data: {
    entryId: string;
    status: string;
    timestamp: string;
    routeId?: string;
    projectId?: string;
  };
  timestamp: string;
}

export interface ClockOutResponse {
  success: boolean;
  data: {
    entryId: string;
    status: string;
    hoursWorked: number;
    timestamp: string;
  };
  timestamp: string;
}

interface StatusResponse {
  success: boolean;
  data: ClockStatus;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class ClockService {
  private apiUrl = `${environment.apiUrl}/timesheets`;

  constructor(private http: HttpClient) {}

  getStatus(): Observable<StatusResponse> {
    return this.http.get<StatusResponse>(`${this.apiUrl}/status`);
  }

  clockIn(params?: {
    projectId?: string;
    routeId?: string;
    location?: { lat: number; lon: number };
    idempotencyKey?: string;
  }): Observable<ClockInResponse> {
    return this.http.post<ClockInResponse>(`${this.apiUrl}/clock-in`, params || {});
  }

  clockOut(entryId?: string): Observable<ClockOutResponse> {
    return this.http.post<ClockOutResponse>(`${this.apiUrl}/clock-out`, { entryId });
  }
}
