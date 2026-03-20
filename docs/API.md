# API Documentation
## TimeKeeper — Waste Services Time Tracking Platform

Base URL: `https://api.timekeeper.app` (production) | `http://localhost:3000` (local)

All responses follow: `{ success: boolean, data: T, timestamp: string, error?: string }`

---

## Authentication

### POST /auth/login
Login with email and password. Returns JWT + sets httpOnly refresh cookie.

**Request:** `{ email: string, password: string }`
**Response:** `{ user: { id, orgId, email, role, firstName, lastName }, token: string }`

### POST /auth/refresh
Refresh JWT using httpOnly cookie or body.

**Request:** `{ refreshToken?: string }` (or cookie)
**Response:** `{ token: string }`

### GET /auth/me
Get current authenticated user.

**Headers:** `Authorization: Bearer <token>`
**Response:** `{ user: { id, orgId, email, role, firstName, lastName, phone, orgName, orgSlug } }`

### POST /auth/register
Register a new user (org_admin only, same org).

**Headers:** `Authorization: Bearer <token>`
**Request:** `{ orgId, email, password, role, firstName?, lastName?, phone? }`
**Response:** `{ user: { id, orgId, email, role } }`

### POST /auth/logout
Clear refresh token cookie.

**Response:** `{ message: "Logged out" }`

---

## Time Tracking

### POST /timesheets/clock-in
Clock in the authenticated user.

**Headers:** `Authorization: Bearer <token>`
**Request:** `{ projectId?: string, routeId?: string, location?: { lat, lon }, idempotencyKey?: string }`
**Response:** `{ entryId, status: "clocked_in", timestamp, routeId, projectId }`

### POST /timesheets/clock-out
Clock out the authenticated user.

**Headers:** `Authorization: Bearer <token>`
**Request:** `{ entryId?: string }`
**Response:** `{ entryId, status: "clocked_out", hoursWorked, timestamp }`

### GET /timesheets/status
Check if user is currently clocked in.

**Headers:** `Authorization: Bearer <token>`
**Response:** `{ clockedIn: boolean, entryId?, clockInTime?, elapsedHours?, routeId?, projectId? }`

### POST /timesheets/sync
Batch sync offline entries.

**Headers:** `Authorization: Bearer <token>`
**Request:** `[{ action, timestamp, projectId?, routeId?, locationLat?, locationLon?, idempotencyKey, entryId? }]`
**Response:** `{ syncedCount, errors: [{ index, error }] }`

---

## Timesheets

### GET /timesheets/mine
Get or create timesheet for current week.

**Headers:** `Authorization: Bearer <token>`
**Response:** `{ timesheetId: string }`

### POST /timesheets/:id/submit
Submit a draft timesheet.

**Headers:** `Authorization: Bearer <token>`
**Response:** `{ status: "submitted" }`

### POST /timesheets/:id/approve
Approve, reject, or request revision (manager/org_admin only).

**Headers:** `Authorization: Bearer <token>`
**Request:** `{ action: "approved" | "rejected" | "revision_requested", notes?: string }`
**Response:** `{ status: string }`

---

## Manager

### GET /manager/dashboard
Get all drivers with status for the manager's org.

**Headers:** `Authorization: Bearer <token>`
**Roles:** manager, org_admin
**Response:** `{ drivers: [{ id, name, status, hours, route, lastUpdate }] }`

### GET /manager/driver/:userId/day
Get a driver's clock entries for today (or specified date).

**Headers:** `Authorization: Bearer <token>`
**Query:** `?date=2026-03-20`
**Response:** `{ entries: [{ id, clockIn, clockOut, hours, routeId, projectId, source }] }`

### GET /manager/driver/:userId/overtime
Get overtime calculation for a driver.

**Headers:** `Authorization: Bearer <token>`
**Query:** `?weekEnding=2026-03-20`
**Response:** `{ regularHours, overtimeHours, doubleTimeHours, totalHours, alerts }`

### GET /manager/approvals/pending
Get timesheets pending approval.

**Headers:** `Authorization: Bearer <token>`
**Response:** `{ timesheets: [{ id, userId, userName, weekEnding, status, hoursWorked, otHours }] }`

### POST /manager/reports/generate
Generate payroll report.

**Headers:** `Authorization: Bearer <token>`
**Request:** `{ period: "weekly" | "biweekly" | "semimonthly" | "monthly", endDate?: string, format?: "csv" | "pdf" | "xlsx" }`
**Response:** CSV/PDF/XLSX file download, or `{ reportId, url, rowCount }` if S3

---

## Dispatcher

### GET /dispatcher/routes
Get cached routes for user's org.

**Headers:** `Authorization: Bearer <token>`
**Response:** `{ routes: [{ id, name, stops, assignedDriverId?, status }] }`

---

## SMS Webhook

### POST /sms/webhook
Twilio incoming SMS webhook (form-encoded).

**Commands:** `IN` (clock in), `OUT` (clock out), `STATUS` (check hours)
**Response:** Empty TwiML `<Response></Response>`

---

## WebSocket Events

Connect: `io('http://localhost:3000', { auth: { token } })`

Auto-joins `org_{orgId}` channel on connect.

| Event | Direction | Payload |
|-------|-----------|---------|
| `clock_in` | Server → Client | `{ userId, entryId, status, timestamp, routeId }` |
| `clock_out` | Server → Client | `{ userId, entryId, status, hoursWorked, timestamp }` |
| `ot_alert` | Server → Client | `{ userId, hours, alertType, message }` |
| `routes_updated` | Server → Client | `{ routes: [...] }` |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| POST /auth/login | 10 requests / 15 minutes |
| All other endpoints | No limit (standard) |

## Authentication

- JWT token: 1-hour expiry, sent as `Authorization: Bearer <token>`
- Refresh token: 7-day expiry, httpOnly cookie on `/auth/refresh` path
- All endpoints except `/auth/login`, `/auth/refresh`, `/sms/webhook`, `/health` require authentication
