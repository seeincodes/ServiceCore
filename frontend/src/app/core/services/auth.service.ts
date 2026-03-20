import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

export interface AuthUser {
  id: string;
  orgId: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
}

interface LoginResponse {
  success: boolean;
  data: {
    user: AuthUser;
    token: string;
  };
  timestamp: string;
}

interface RefreshResponse {
  success: boolean;
  data: { token: string };
  timestamp: string;
}

interface MeResponse {
  success: boolean;
  data: { user: AuthUser };
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = `${environment.apiUrl}/auth`;
  private currentUserSubject = new BehaviorSubject<AuthUser | null>(null);
  private tokenKey = 'tk_token';

  currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {
    const token = this.getToken();
    if (token) {
      this.loadCurrentUser();
    }
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.apiUrl}/login`, { email, password }, { withCredentials: true })
      .pipe(
        tap((res) => {
          localStorage.setItem(this.tokenKey, res.data.token);
          this.currentUserSubject.next(res.data.user);
        }),
      );
  }

  logout(): void {
    this.http.post(`${this.apiUrl}/logout`, {}, { withCredentials: true }).subscribe();
    localStorage.removeItem(this.tokenKey);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  refreshToken(): Observable<RefreshResponse> {
    return this.http
      .post<RefreshResponse>(`${this.apiUrl}/refresh`, {}, { withCredentials: true })
      .pipe(
        tap((res) => {
          localStorage.setItem(this.tokenKey, res.data.token);
        }),
      );
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  get isAuthenticated(): boolean {
    return !!this.getToken();
  }

  get currentUser(): AuthUser | null {
    return this.currentUserSubject.value;
  }

  private loadCurrentUser(): void {
    this.http.get<MeResponse>(`${this.apiUrl}/me`).subscribe({
      next: (res) => this.currentUserSubject.next(res.data.user),
      error: () => {
        localStorage.removeItem(this.tokenKey);
        this.currentUserSubject.next(null);
      },
    });
  }
}
