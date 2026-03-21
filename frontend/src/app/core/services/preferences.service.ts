import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface UserPreferences {
  distanceUnit: 'mi' | 'km';
  timeFormat: '12' | '24';
  language: string;
}

const DEFAULTS: UserPreferences = {
  distanceUnit: 'mi',
  timeFormat: '12',
  language: 'en',
};

@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private prefs: UserPreferences = { ...DEFAULTS };
  private loaded = false;

  constructor(private http: HttpClient) {}

  /** Load preferences from server, fall back to localStorage. */
  load(): void {
    // Immediately use localStorage values
    this.prefs = {
      distanceUnit:
        (localStorage.getItem('tk_distance_unit') as 'mi' | 'km') || DEFAULTS.distanceUnit,
      timeFormat: (localStorage.getItem('tk_time_format') as '12' | '24') || DEFAULTS.timeFormat,
      language: localStorage.getItem('tk_lang') || DEFAULTS.language,
    };

    // Then sync from server (overrides local if server has values)
    this.http.get<any>(`${environment.apiUrl}/auth/preferences`).subscribe({
      next: (res) => {
        const server = res.data?.preferences || {};
        if (server.distanceUnit) this.prefs.distanceUnit = server.distanceUnit;
        if (server.timeFormat) this.prefs.timeFormat = server.timeFormat;
        if (server.language) this.prefs.language = server.language;
        this.syncToLocal();
        this.loaded = true;
      },
      error: () => {
        this.loaded = true; // Use local values
      },
    });
  }

  get distanceUnit(): 'mi' | 'km' {
    return this.prefs.distanceUnit;
  }

  get useMiles(): boolean {
    return this.prefs.distanceUnit === 'mi';
  }

  get timeFormat(): '12' | '24' {
    return this.prefs.timeFormat;
  }

  get use24Hour(): boolean {
    return this.prefs.timeFormat === '24';
  }

  get language(): string {
    return this.prefs.language;
  }

  /** Update a preference — saves to localStorage and server. */
  set(key: keyof UserPreferences, value: string): void {
    (this.prefs as any)[key] = value;
    this.syncToLocal();
    this.syncToServer();
  }

  toggleDistanceUnit(): void {
    this.set('distanceUnit', this.prefs.distanceUnit === 'mi' ? 'km' : 'mi');
  }

  toggleTimeFormat(): void {
    this.set('timeFormat', this.prefs.timeFormat === '12' ? '24' : '12');
  }

  setLanguage(lang: string): void {
    this.set('language', lang);
  }

  private syncToLocal(): void {
    localStorage.setItem('tk_distance_unit', this.prefs.distanceUnit);
    localStorage.setItem('tk_time_format', this.prefs.timeFormat);
    localStorage.setItem('tk_lang', this.prefs.language);
  }

  private syncToServer(): void {
    this.http.put(`${environment.apiUrl}/auth/preferences`, this.prefs).subscribe();
  }
}
