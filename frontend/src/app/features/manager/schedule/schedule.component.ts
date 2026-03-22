import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface ScheduleEntry {
  id: string;
  driverId: string;
  date: string;
  projectId: string;
  projectName: string;
  projectColor: string;
  routeId: string;
  routeName: string;
  shiftStart: string;
  shiftEnd: string;
}

interface Driver {
  userId: string;
  firstName: string;
  lastName: string;
}

interface Project {
  id: string;
  name: string;
  color: string;
}

interface ShiftTemplate {
  id: string;
  name: string;
  shiftStart: string;
  shiftEnd: string;
  projectId: string;
  projectName: string;
  routeId: string;
  color: string;
}

@Component({
  selector: 'app-schedule',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './schedule.component.html',
  styleUrls: ['./schedule.component.scss'],
})
export class ScheduleComponent implements OnInit {
  private apiUrl = environment.apiUrl;

  weekStart: Date = new Date();
  weekDays: Date[] = [];
  dayLabels: string[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  drivers: Driver[] = [];
  projects: Project[] = [];
  scheduleEntries: ScheduleEntry[] = [];
  loading = true;

  // Editing state
  editingCell: { driverId: string; date: string } | null = null;
  editEntry: Partial<ScheduleEntry> = {};
  editMode: 'add' | 'edit' = 'add';
  editEntryId: string | null = null;
  saving = false;

  // Templates
  showTemplates = false;
  templates: ShiftTemplate[] = [];
  templatesLoading = false;
  showAddTemplate = false;
  newTemplate: Partial<ShiftTemplate> = {};
  editTemplateId: string | null = null;
  editTemplate: Partial<ShiftTemplate> = {};

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.setWeekStart(this.getMonday(new Date()));
    this.loadDrivers();
    this.loadProjects();
    this.loadTemplates();
  }

  // Week navigation
  get weekLabel(): string {
    const end = new Date(this.weekStart);
    end.setDate(end.getDate() + 6);
    const fmt = (d: Date) => d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `${fmt(this.weekStart)} - ${fmt(end)}`;
  }

  prevWeek(): void {
    const d = new Date(this.weekStart);
    d.setDate(d.getDate() - 7);
    this.setWeekStart(d);
  }

  nextWeek(): void {
    const d = new Date(this.weekStart);
    d.setDate(d.getDate() + 7);
    this.setWeekStart(d);
  }

  private setWeekStart(d: Date): void {
    this.weekStart = d;
    this.weekDays = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(d);
      day.setDate(day.getDate() + i);
      this.weekDays.push(day);
    }
    this.loadSchedule();
  }

  private getMonday(d: Date): Date {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(d);
    mon.setDate(diff);
    mon.setHours(0, 0, 0, 0);
    return mon;
  }

  private dateStr(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  dayHeader(d: Date): string {
    return d.toLocaleDateString([], { weekday: 'short', day: 'numeric' });
  }

  // Data loading
  private loadSchedule(): void {
    this.loading = true;
    const ws = this.dateStr(this.weekStart);
    this.http
      .get<{ data: ScheduleEntry[] }>(`${this.apiUrl}/manager/schedule?weekStart=${ws}`)
      .subscribe({
        next: (res) => {
          this.scheduleEntries = res.data || [];
          this.loading = false;
        },
        error: () => {
          this.scheduleEntries = [];
          this.loading = false;
        },
      });
  }

  private loadDrivers(): void {
    this.http.get<{ data: { drivers: Driver[] } }>(`${this.apiUrl}/manager/dashboard`).subscribe({
      next: (res) => {
        this.drivers = res.data?.drivers || [];
      },
    });
  }

  private loadProjects(): void {
    this.http.get<{ data: Project[] }>(`${this.apiUrl}/admin/projects`).subscribe({
      next: (res) => {
        this.projects = res.data || [];
      },
    });
  }

  // Grid helpers
  getEntry(driverId: string, date: Date): ScheduleEntry | undefined {
    const ds = this.dateStr(date);
    return this.scheduleEntries.find((e) => e.driverId === driverId && e.date === ds);
  }

  cellColor(entry: ScheduleEntry | undefined): string {
    if (!entry) return '';
    return entry.projectColor || '#e0e0e0';
  }

  // Cell click
  onCellClick(driverId: string, date: Date): void {
    const existing = this.getEntry(driverId, date);
    if (existing) {
      this.editMode = 'edit';
      this.editEntryId = existing.id;
      this.editEntry = { ...existing };
    } else {
      this.editMode = 'add';
      this.editEntryId = null;
      this.editEntry = {
        driverId,
        date: this.dateStr(date),
        projectId: '',
        routeId: '',
        shiftStart: '07:00',
        shiftEnd: '15:00',
      };
    }
    this.editingCell = { driverId, date: this.dateStr(date) };
  }

  isEditing(driverId: string, date: Date): boolean {
    return this.editingCell?.driverId === driverId && this.editingCell?.date === this.dateStr(date);
  }

  cancelEdit(): void {
    this.editingCell = null;
    this.editEntry = {};
  }

  saveSchedule(): void {
    this.saving = true;
    const body = {
      driverId: this.editEntry.driverId,
      date: this.editEntry.date,
      projectId: this.editEntry.projectId,
      routeId: this.editEntry.routeId,
      shiftStart: this.editEntry.shiftStart,
      shiftEnd: this.editEntry.shiftEnd,
    };

    if (this.editMode === 'edit' && this.editEntryId) {
      this.http
        .post<{ data: ScheduleEntry }>(`${this.apiUrl}/manager/schedule`, {
          ...body,
          id: this.editEntryId,
        })
        .subscribe({
          next: () => {
            this.saving = false;
            this.editingCell = null;
            this.loadSchedule();
          },
          error: () => {
            this.saving = false;
          },
        });
    } else {
      this.http.post<{ data: ScheduleEntry }>(`${this.apiUrl}/manager/schedule`, body).subscribe({
        next: () => {
          this.saving = false;
          this.editingCell = null;
          this.loadSchedule();
        },
        error: () => {
          this.saving = false;
        },
      });
    }
  }

  deleteSchedule(): void {
    if (!this.editEntryId) return;
    this.http.delete(`${this.apiUrl}/manager/schedule/${this.editEntryId}`).subscribe({
      next: () => {
        this.editingCell = null;
        this.loadSchedule();
      },
    });
  }

  // From template
  applyTemplate(template: ShiftTemplate): void {
    this.editEntry.projectId = template.projectId;
    this.editEntry.routeId = template.routeId;
    this.editEntry.shiftStart = template.shiftStart;
    this.editEntry.shiftEnd = template.shiftEnd;
  }

  // Template management
  toggleTemplates(): void {
    this.showTemplates = !this.showTemplates;
  }

  private loadTemplates(): void {
    this.templatesLoading = true;
    this.http
      .get<{ data: ShiftTemplate[] }>(`${this.apiUrl}/manager/schedule/templates`)
      .subscribe({
        next: (res) => {
          this.templates = res.data || [];
          this.templatesLoading = false;
        },
        error: () => {
          this.templates = [];
          this.templatesLoading = false;
        },
      });
  }

  openAddTemplate(): void {
    this.showAddTemplate = true;
    this.newTemplate = {
      name: '',
      shiftStart: '07:00',
      shiftEnd: '15:00',
      projectId: '',
      routeId: '',
      color: '#1a73e8',
    };
  }

  cancelAddTemplate(): void {
    this.showAddTemplate = false;
    this.newTemplate = {};
  }

  saveNewTemplate(): void {
    this.http
      .post<{ data: ShiftTemplate }>(`${this.apiUrl}/manager/schedule/templates`, this.newTemplate)
      .subscribe({
        next: (res) => {
          if (res.data) {
            this.templates.push(res.data);
          }
          this.showAddTemplate = false;
          this.newTemplate = {};
        },
      });
  }

  startEditTemplate(template: ShiftTemplate): void {
    this.editTemplateId = template.id;
    this.editTemplate = { ...template };
  }

  cancelEditTemplate(): void {
    this.editTemplateId = null;
    this.editTemplate = {};
  }

  saveEditTemplate(): void {
    if (!this.editTemplateId) return;
    this.http
      .post<{ data: ShiftTemplate }>(`${this.apiUrl}/manager/schedule/templates`, {
        ...this.editTemplate,
        id: this.editTemplateId,
      })
      .subscribe({
        next: () => {
          this.editTemplateId = null;
          this.loadTemplates();
        },
      });
  }

  deleteTemplate(id: string): void {
    this.http.delete(`${this.apiUrl}/manager/schedule/templates/${id}`).subscribe({
      next: () => {
        this.templates = this.templates.filter((t) => t.id !== id);
      },
    });
  }

  projectName(id: string): string {
    const p = this.projects.find((p) => p.id === id);
    return p ? p.name : '';
  }

  driverName(driver: Driver): string {
    return `${driver.firstName} ${driver.lastName}`;
  }
}
