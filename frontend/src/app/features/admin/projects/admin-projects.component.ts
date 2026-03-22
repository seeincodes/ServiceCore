import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface Project {
  id: string;
  code: string;
  name: string;
  description: string | null;
  color: string | null;
  isActive: boolean;
  budgetedHours: number | null;
  budgetAmount: number | null;
  hours?: number;
  cost?: number;
  driverCount?: number;
}

@Component({
  selector: 'app-admin-projects',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-projects.component.html',
  styleUrls: ['./admin-projects.component.scss'],
})
export class AdminProjectsComponent implements OnInit {
  projects: Project[] = [];
  loading = true;
  error: string | null = null;
  message: { text: string; type: 'success' | 'error' } | null = null;

  showAddForm = false;
  newProject = {
    code: '',
    name: '',
    description: '',
    color: '#1a73e8',
    budgetedHours: null as number | null,
    budgetAmount: null as number | null,
  };
  saving = false;

  editingProjectId: string | null = null;
  editProject = {
    code: '',
    name: '',
    description: '',
    color: '#1a73e8',
    budgetedHours: null as number | null,
    budgetAmount: null as number | null,
  };

  private apiUrl = `${environment.apiUrl}/admin/projects`;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadProjects();
  }

  toggleAddForm(): void {
    this.showAddForm = !this.showAddForm;
    this.editingProjectId = null;
    this.message = null;
    this.newProject = {
      code: '',
      name: '',
      description: '',
      color: '#1a73e8',
      budgetedHours: null,
      budgetAmount: null,
    };
  }

  addProject(): void {
    this.saving = true;
    const body: any = {
      code: this.newProject.code,
      name: this.newProject.name,
    };
    if (this.newProject.description) body.description = this.newProject.description;
    if (this.newProject.color) body.color = this.newProject.color;
    if (this.newProject.budgetedHours) body.budgetedHours = this.newProject.budgetedHours;
    if (this.newProject.budgetAmount) body.budgetAmount = this.newProject.budgetAmount;

    this.http.post<any>(this.apiUrl, body).subscribe({
      next: () => {
        this.saving = false;
        this.showAddForm = false;
        this.message = { text: 'Project created', type: 'success' };
        this.loadProjects();
      },
      error: (err) => {
        this.saving = false;
        this.message = { text: err.error?.error || 'Failed to create project', type: 'error' };
      },
    });
  }

  startEdit(project: Project): void {
    this.editingProjectId = project.id;
    this.editProject = {
      code: project.code,
      name: project.name,
      description: project.description || '',
      color: project.color || '#1a73e8',
      budgetedHours: project.budgetedHours,
      budgetAmount: project.budgetAmount,
    };
    this.showAddForm = false;
    this.message = null;
  }

  cancelEdit(): void {
    this.editingProjectId = null;
  }

  saveEdit(projectId: string): void {
    this.saving = true;
    this.http
      .put<any>(`${this.apiUrl}/${projectId}`, {
        code: this.editProject.code,
        name: this.editProject.name,
        description: this.editProject.description || null,
        color: this.editProject.color,
        budgetedHours: this.editProject.budgetedHours,
        budgetAmount: this.editProject.budgetAmount,
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.editingProjectId = null;
          this.message = { text: 'Project updated', type: 'success' };
          this.loadProjects();
        },
        error: (err) => {
          this.saving = false;
          this.message = { text: err.error?.error || 'Failed to update project', type: 'error' };
        },
      });
  }

  toggleActive(project: Project): void {
    this.http.put<any>(`${this.apiUrl}/${project.id}`, { isActive: !project.isActive }).subscribe({
      next: () => {
        this.message = {
          text: project.isActive ? 'Project deactivated' : 'Project activated',
          type: 'success',
        };
        this.loadProjects();
      },
      error: (err) => {
        this.message = { text: err.error?.error || 'Failed to update project', type: 'error' };
      },
    });
  }

  deleteProject(project: Project): void {
    if (!confirm(`Delete project "${project.name}"? This cannot be undone.`)) return;
    this.http.delete<any>(`${this.apiUrl}/${project.id}`).subscribe({
      next: () => {
        this.message = { text: 'Project deleted', type: 'success' };
        this.loadProjects();
      },
      error: (err) => {
        this.message = { text: err.error?.error || 'Failed to delete project', type: 'error' };
      },
    });
  }

  private loadProjects(): void {
    this.loading = true;
    this.error = null;
    this.http.get<any>(this.apiUrl).subscribe({
      next: (res) => {
        this.projects = (res.data.projects || []).map((p: any) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          description: p.description,
          color: p.color,
          isActive: p.is_active ?? p.isActive ?? true,
          budgetedHours: p.budgeted_hours != null ? Number(p.budgeted_hours) : null,
          budgetAmount: p.budget_amount != null ? Number(p.budget_amount) : null,
        }));
        this.loading = false;
        this.loadAllocation();
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error || 'Failed to load projects';
      },
    });
  }

  private loadAllocation(): void {
    this.http.get<any>(`${environment.apiUrl}/manager/project-allocation`).subscribe({
      next: (res) => {
        const allocations = res.data?.allocation || [];
        for (const alloc of allocations) {
          // Match by project name which contains the code
          const project = this.projects.find((p) => alloc.project?.includes(p.code));
          if (project) {
            project.hours = alloc.hours;
            project.cost = alloc.cost;
            project.driverCount = alloc.driverCount;
          }
        }
      },
    });
  }
}
