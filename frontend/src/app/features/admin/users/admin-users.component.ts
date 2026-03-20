import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface OrgUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  phone: string | null;
  is_active: boolean;
}

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.scss'],
})
export class AdminUsersComponent implements OnInit {
  users: OrgUser[] = [];
  loading = true;
  showAddForm = false;
  editingUser: OrgUser | null = null;
  message: { text: string; type: 'success' | 'error' } | null = null;

  newUser = { email: '', password: '', firstName: '', lastName: '', role: 'employee', phone: '' };
  saving = false;

  private apiUrl = `${environment.apiUrl}/admin`;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  toggleAddForm(): void {
    this.showAddForm = !this.showAddForm;
    this.editingUser = null;
    this.message = null;
    this.newUser = {
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      role: 'employee',
      phone: '',
    };
  }

  addUser(): void {
    this.saving = true;
    this.http.post<any>(`${this.apiUrl}/users`, this.newUser).subscribe({
      next: () => {
        this.saving = false;
        this.showAddForm = false;
        this.message = { text: 'User created', type: 'success' };
        this.loadUsers();
      },
      error: (err) => {
        this.saving = false;
        this.message = { text: err.error?.error || 'Failed to create user', type: 'error' };
      },
    });
  }

  editUser(user: OrgUser): void {
    this.editingUser = { ...user };
    this.showAddForm = false;
    this.message = null;
  }

  saveEdit(): void {
    if (!this.editingUser) return;
    this.saving = true;

    this.http
      .put<any>(`${this.apiUrl}/users/${this.editingUser.id}`, {
        role: this.editingUser.role,
        isActive: this.editingUser.is_active,
        firstName: this.editingUser.first_name,
        lastName: this.editingUser.last_name,
        phone: this.editingUser.phone,
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.editingUser = null;
          this.message = { text: 'User updated', type: 'success' };
          this.loadUsers();
        },
        error: (err) => {
          this.saving = false;
          this.message = { text: err.error?.error || 'Update failed', type: 'error' };
        },
      });
  }

  cancelEdit(): void {
    this.editingUser = null;
  }

  toggleActive(user: OrgUser): void {
    this.http.put<any>(`${this.apiUrl}/users/${user.id}`, { isActive: !user.is_active }).subscribe({
      next: () => this.loadUsers(),
      error: (err) => {
        this.message = { text: err.error?.error || 'Failed', type: 'error' };
      },
    });
  }

  roleLabel(role: string): string {
    return (
      { employee: 'Driver', manager: 'Manager', payroll_admin: 'Payroll', org_admin: 'Admin' }[
        role
      ] || role
    );
  }

  private loadUsers(): void {
    this.http.get<any>(`${this.apiUrl}/users`).subscribe({
      next: (res) => {
        this.users = res.data.users;
        this.loading = false;
      },
    });
  }
}
