export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  timestamp: string;
  error?: string;
}

export type UserRole = 'employee' | 'manager' | 'payroll_admin' | 'org_admin';

export type TimesheetStatus = 'draft' | 'submitted' | 'approved' | 'locked';

export type ApprovalStatus = 'approved' | 'rejected' | 'revision_requested';

export type ClockSource = 'app' | 'sms' | 'ivr';

export interface AuthenticatedUser {
  id: string;
  orgId: string;
  email: string;
  role: UserRole;
}

export interface Org {
  id: string;
  name: string;
  slug: string;
  branding: Record<string, unknown>;
  config: OrgConfig;
  stripeCustomerId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrgConfig {
  otRules: 'federal' | 'california' | string;
  workWeekStart: string;
  approvalRequired: boolean;
}

export interface User {
  id: string;
  orgId: string;
  email: string;
  phone?: string;
  passwordHash: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClockEntry {
  id: string;
  orgId: string;
  userId: string;
  clockIn: Date;
  clockOut?: Date;
  projectId?: string;
  routeId?: string;
  locationLat?: number;
  locationLon?: number;
  source: ClockSource;
  syncedAt?: Date;
  idempotencyKey?: string;
  createdAt: Date;
}

export interface Timesheet {
  id: string;
  orgId: string;
  userId: string;
  weekEnding: Date;
  status: TimesheetStatus;
  hoursWorked: number;
  otHours: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TimesheetApproval {
  id: string;
  orgId: string;
  timesheetId: string;
  managerId: string;
  status: ApprovalStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
