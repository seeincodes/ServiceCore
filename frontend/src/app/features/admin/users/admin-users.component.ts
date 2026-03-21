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
  hourly_rate: number | null;
  ot_multiplier: number | null;
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
  ptoUser: OrgUser | null = null;
  ptoBalances: { type: string; label: string; total: number; used: number }[] = [];

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
        hourlyRate: this.editingUser.hourly_rate || undefined,
        otMultiplier: this.editingUser.ot_multiplier || undefined,
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

  openPtoEditor(user: OrgUser): void {
    this.ptoUser = user;
    this.editingUser = null;
    this.showAddForm = false;

    this.http.get<any>(`${environment.apiUrl}/time-off/balances?userId=${user.id}`).subscribe({
      next: (res) => {
        const b = res.data.balances;
        this.ptoBalances = [
          {
            type: 'pto',
            label: 'PTO (Vacation)',
            total: b.pto?.total || 0,
            used: b.pto?.used || 0,
          },
          { type: 'sick', label: 'Sick Leave', total: b.sick?.total || 0, used: b.sick?.used || 0 },
          {
            type: 'personal',
            label: 'Personal',
            total: b.personal?.total || 0,
            used: b.personal?.used || 0,
          },
        ];
      },
    });
  }

  savePtoBalances(): void {
    if (!this.ptoUser) return;
    this.saving = true;
    const userId = this.ptoUser.id;
    let completed = 0;

    for (const b of this.ptoBalances) {
      this.http
        .put(`${environment.apiUrl}/time-off/balances`, {
          userId,
          type: b.type,
          totalHours: b.total,
        })
        .subscribe({
          next: () => {
            completed++;
            if (completed === this.ptoBalances.length) {
              this.saving = false;
              this.message = { text: 'Balances updated', type: 'success' };
              this.ptoUser = null;
              setTimeout(() => (this.message = null), 3000);
            }
          },
          error: () => {
            this.saving = false;
            this.message = { text: 'Failed to update balances', type: 'error' };
          },
        });
    }
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
