import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface DriverStatus {
  id: string;
  name: string;
  status: 'clocked_in' | 'clocked_out';
  hours: number;
  route: string | null;
  lastUpdate: string;
}

export interface DriverDayEntry {
  id: string;
  clockIn: string;
  clockOut: string | null;
  hours: number | null;
  routeId: string | null;
  projectId: string | null;
  source: string;
}

interface DashboardResponse {
  success: boolean;
  data: { drivers: DriverStatus[] };
  timestamp: string;
}

interface DriverDayResponse {
  success: boolean;
  data: { entries: DriverDayEntry[] };
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private apiUrl = 'http://localhost:3000/manager';

  constructor(private http: HttpClient) {}

  getDashboard(): Observable<DashboardResponse> {
    return this.http.get<DashboardResponse>(`${this.apiUrl}/dashboard`);
  }

  getDriverDay(userId: string, date?: string): Observable<DriverDayResponse> {
    const params = date ? `?date=${date}` : '';
    return this.http.get<DriverDayResponse>(`${this.apiUrl}/driver/${userId}/day${params}`);
  }
}
