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
  newProject = { code: '', name: '', description: '', color: '#1a73e8' };
  saving = false;

  editingProjectId: string | null = null;
  editProject = { code: '', name: '', description: '', color: '#1a73e8' };

  private apiUrl = `${environment.apiUrl}/admin/projects`;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadProjects();
  }

  toggleAddForm(): void {
    this.showAddForm = !this.showAddForm;
    this.editingProjectId = null;
    this.message = null;
    this.newProject = { code: '', name: '', description: '', color: '#1a73e8' };
  }

  addProject(): void {
    this.saving = true;
    const body: any = {
      code: this.newProject.code,
      name: this.newProject.name,
    };
    if (this.newProject.description) body.description = this.newProject.description;
    if (this.newProject.color) body.color = this.newProject.color;

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
        this.projects = res.data.projects;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error || 'Failed to load projects';
      },
    });
  }
}
