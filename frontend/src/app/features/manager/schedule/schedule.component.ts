import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface ScheduleEntry {
  id: string;
  userId: string;
  date: string;
  projectId: string;
  projectName: string;
  projectColor: string;
  routeId: string;
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
  editingCell: { userId: string; date: string } | null = null;
  editEntry: Partial<ScheduleEntry> = {};
  editMode: 'add' | 'edit' = 'add';
  editEntryId: string | null = null;
  saving = false;
  popoverStyle: Record<string, string> = {};

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
    this.http.get<any>(`${this.apiUrl}/manager/schedule?weekStart=${ws}`).subscribe({
      next: (res) => {
        this.scheduleEntries = res.data?.schedules || [];
        this.loading = false;
      },
      error: () => {
        this.scheduleEntries = [];
        this.loading = false;
      },
    });
  }

  private loadDrivers(): void {
    this.http.get<any>(`${this.apiUrl}/manager/dashboard`).subscribe({
      next: (res) => {
        this.drivers = (res.data?.drivers || []).map((d: any) => {
          const parts = (d.name || '').split(' ');
          return {
            userId: d.id,
            firstName: parts[0] || '',
            lastName: parts.slice(1).join(' ') || '',
          };
        });
      },
    });
  }

  private loadProjects(): void {
    this.http.get<any>(`${this.apiUrl}/admin/projects`).subscribe({
      next: (res) => {
        this.projects = res.data?.projects || [];
      },
    });
  }

  // Grid helpers
  getEntry(userId: string, date: Date): ScheduleEntry | undefined {
    const ds = this.dateStr(date);
    return this.scheduleEntries.find((e) => e.userId === userId && e.date === ds);
  }

  cellColor(entry: ScheduleEntry | undefined): string {
    if (!entry) return '';
    return entry.projectColor || '#e0e0e0';
  }

  // Cell click
  onCellClick(userId: string, date: Date, event: MouseEvent): void {
    const existing = this.getEntry(userId, date);
    if (existing) {
      this.editMode = 'edit';
      this.editEntryId = existing.id;
      this.editEntry = { ...existing };
    } else {
      this.editMode = 'add';
      this.editEntryId = null;
      this.editEntry = {
        userId,
        date: this.dateStr(date),
        projectId: '',
        routeId: '',
        shiftStart: '07:00',
        shiftEnd: '15:00',
      };
    }
    this.editingCell = { userId, date: this.dateStr(date) };

    // Position popover near click, keeping it on screen
    const td = event.currentTarget as HTMLElement;
    const rect = td.getBoundingClientRect();
    const popoverH = 300;
    const popoverW = 240;
    let top = rect.top;
    let left = rect.left;

    if (top + popoverH > window.innerHeight) {
      top = window.innerHeight - popoverH - 16;
    }
    if (left + popoverW > window.innerWidth) {
      left = window.innerWidth - popoverW - 16;
    }

    this.popoverStyle = {
      top: `${Math.max(8, top)}px`,
      left: `${Math.max(8, left)}px`,
    };
  }

  isEditing(userId: string, date: Date): boolean {
    return this.editingCell?.userId === userId && this.editingCell?.date === this.dateStr(date);
  }

  cancelEdit(): void {
    this.editingCell = null;
    this.editEntry = {};
  }

  saveSchedule(): void {
    this.saving = true;
    const body = {
      userId: this.editEntry.userId,
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

  get routesForProject(): { routeId: string; label: string }[] {
    const pid = this.editEntry.projectId;
    if (!pid) return [];
    // Get unique routes from templates that match this project
    const seen = new Set<string>();
    const routes: { routeId: string; label: string }[] = [];
    for (const tpl of this.templates) {
      if (tpl.projectId === pid && tpl.routeId && !seen.has(tpl.routeId)) {
        seen.add(tpl.routeId);
        routes.push({ routeId: tpl.routeId, label: tpl.routeId });
      }
    }
    return routes;
  }

  onProjectChange(): void {
    const routes = this.routesForProject;
    if (routes.length > 0) {
      this.editEntry.routeId = routes[0].routeId;
    } else {
      this.editEntry.routeId = '';
    }
    // Also auto-fill shift times from the first matching template
    const tpl = this.templates.find((t) => t.projectId === this.editEntry.projectId);
    if (tpl) {
      this.editEntry.shiftStart = tpl.shiftStart;
      this.editEntry.shiftEnd = tpl.shiftEnd;
    }
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
    this.http.get<any>(`${this.apiUrl}/manager/shift-templates`).subscribe({
      next: (res) => {
        const raw = res.data?.templates || res.data || [];
        this.templates = raw.map((t: any) => ({
          id: t.id,
          name: t.name,
          shiftStart: t.shift_start || t.shiftStart,
          shiftEnd: t.shift_end || t.shiftEnd,
          projectId: t.project_id || t.projectId,
          routeId: t.route_id || t.routeId,
          color: t.color,
        }));
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
