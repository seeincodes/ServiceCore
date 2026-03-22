# TimeKeeper

Waste services employee time tracking platform. White-label SaaS with offline-first design, SMS/IVR clock-in, real-time manager dashboards, and QuickBooks payroll integration.

## Production URLs

| Service  | URL |
|----------|-----|
| Frontend | http://timekeeper-frontend-prod.s3-website-us-east-1.amazonaws.com |
| API      | http://timekeeper-alb-487875782.us-east-1.elb.amazonaws.com |
| Health   | http://timekeeper-alb-487875782.us-east-1.elb.amazonaws.com/health |

## Quick Start

```bash
# Start databases
docker-compose up -d postgres redis

# Install dependencies
cd backend && npm install && cd ../frontend && npm install && cd ..

# Run migrations + seed (development)
cd backend
npx knex migrate:latest --knexfile src/shared/database/knexfile.ts
npx knex seed:run --knexfile src/shared/database/knexfile.ts
cd ..

# Start servers
cd backend && npm run dev      # API → http://localhost:3000
cd frontend && npx ng serve    # App → http://localhost:4200
```

Open http://localhost:4200/login and use a demo account.

## Environments

| Environment | Database | Port | .env File | Seed Data |
|-------------|----------|------|-----------|-----------|
| **Development** | `timekeeper_dev` | PG 5433, Redis 6380 | `.env.development` | 3 orgs, 17 users, 110 clock entries, timesheets in all states |
| **Test** | `timekeeper_test` | PG 5433, Redis 6380 | `.env.test` | Same seed as dev (ephemeral, reset per test run) |
| **Production** | AWS RDS | AWS managed | `.env.production` | 5 orgs with admin-only accounts (no test data) |

### Switching Environments

```bash
# Development (default)
NODE_ENV=development npm run dev

# Test
NODE_ENV=test npm test

# Run migrations on test DB
NODE_ENV=test npx knex migrate:latest --knexfile src/shared/database/knexfile.ts

# Seed production DB (run once on first deploy)
NODE_ENV=production npx knex seed:run --knexfile src/shared/database/knexfile.ts
```

### Environment Files

- `.env.development` — Local dev with Docker databases, debug logging, dev JWT secret
- `.env.test` — Automated tests, separate DB, integrations disabled
- `.env.production` — Template only (values set via AWS SSM Parameter Store)

## Demo Accounts

All environments use password `password123` (dev/test) or `ChangeMe!2026` (production).

### Development / Test

| Role | Email | Org |
|------|-------|-----|
| Admin | admin@greenwaste.com | GreenWaste Solutions |
| Manager | manager@greenwaste.com | GreenWaste Solutions |
| Payroll | payroll@greenwaste.com | GreenWaste Solutions |
| Driver | driver1@greenwaste.com | GreenWaste Solutions |
| Driver | driver2@greenwaste.com | GreenWaste Solutions |
| Admin | admin@metrodisposal.com | Metro Disposal Co |
| Manager | manager@metrodisposal.com | Metro Disposal Co |
| Driver | driver1@metrodisposal.com | Metro Disposal Co |
| Admin | owner@sunrise.com | Sunrise Sanitation |

### Production (initial seed)

| Email | Org | Notes |
|-------|-----|-------|
| admin@greenwaste.com | GreenWaste Solutions | Federal OT, SMS + QB |
| admin@metrodisposal.com | Metro Disposal Co | California OT, SMS + QB |
| owner@sunrise.com | Sunrise Sanitation | Free tier, no SMS |
| admin@pacificwaste.com | Pacific Waste Management | Enterprise, all features + dispatcher |
| admin@ecohaul.com | EcoHaul Services | Federal OT, SMS only |

## Seed Data Details

### Development (rich data for testing)

- **3 orgs** with different configurations (federal vs California OT, SMS enabled/disabled)
- **17 users** across all roles (admin, manager, payroll, employee)
- **110 clock entries** spanning 2 weeks of realistic work patterns:
  - GreenWaste: 6 drivers, 7.5-10h days, varied routes
  - Metro Disposal: 3 drivers, 8-12h days (California OT territory)
  - Sunrise: 2 drivers, 6-8h days
- **9 timesheets** in mixed states (draft, submitted, approved)
- **Approval records** for approved timesheets
- **Audit log entries** for admin actions

### Production (admin-only bootstrap)

- **5 orgs** representing different tiers and configurations
- **1 admin per org** — add employees via the admin UI
- No fake drivers, clock entries, or timesheets
- Skips seed if data already exists (safe to re-run)

## Architecture

```
frontend/     Angular 17 PWA (standalone components, NgRx, Service Workers)
backend/      Node.js + TypeScript (Express, 6 service modules)
infra/        Terraform (AWS: VPC, RDS, ElastiCache, ECS/Fargate, ALB, SQS, S3)
```

### Backend Services

| Module | Purpose |
|--------|---------|
| `auth/` | JWT login, refresh, RBAC, rate limiting |
| `time-tracking/` | Clock in/out, sync, dashboard, timesheets, OT calculation |
| `dispatcher/` | Route polling, Redis cache, WebSocket push |
| `payroll/` | CSV/PDF/Excel reports, S3 export |
| `notifications/` | SendGrid email, Twilio SMS, SQS queue |
| `integration/` | QuickBooks nightly sync, Stripe billing |

### Key Tech

- **Offline-first:** IndexedDB + Service Workers, batch sync with idempotency keys
- **Real-time:** Socket.io WebSocket with org-channel isolation
- **Multi-tenant:** org_id on every table, PostgreSQL RLS, middleware enforcement
- **OT rules:** Federal (40h/week) + California (8h/day, 12h double time)

## Scripts

```bash
# Backend
npm run dev          # Start dev server with hot reload
npm run build        # Compile TypeScript
npm test             # Run Jest tests
npm run migrate      # Run database migrations
npm run seed         # Seed database

# Frontend
npx ng serve         # Dev server on :4200
npx ng build         # Production build
npx ng test          # Karma unit tests

# Root
npm run dev:api      # Start backend
npm run dev:frontend # Start frontend
```

## Ports

| Service | Development | Test |
|---------|-------------|------|
| API | 3000 | 3001 |
| Frontend | 4200 | — |
| PostgreSQL | 5433 | 5433 |
| Redis | 6380 | 6380 |
