# TimeKeeper

Waste services employee time tracking platform. White-label SaaS with offline-first design, SMS/IVR clock-in, real-time manager dashboards, and QuickBooks payroll integration.

## Production URLs

| Service  | URL |
|----------|-----|
| Frontend | https://d3clmhpkov5orm.cloudfront.net |
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
| **Production** | AWS RDS | AWS managed | `.env.production` | 5 orgs with full demo data (users, clock entries, timesheets) |

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

### Production

| Role | Email | Org |
|------|-------|-----|
| Admin | admin@greenwaste.com | GreenWaste Solutions |
| Manager | manager@greenwaste.com | GreenWaste Solutions |
| Payroll | payroll@greenwaste.com | GreenWaste Solutions |
| Driver | driver1@greenwaste.com | GreenWaste Solutions |
| Admin | admin@metrodisposal.com | Metro Disposal Co |
| Manager | manager@metrodisposal.com | Metro Disposal Co |
| Admin | owner@sunrise.com | Sunrise Sanitation |
| Admin | admin@pacificwaste.com | Pacific Waste Management |
| Admin | admin@ecohaul.com | EcoHaul Services |

## Seed Data Details

### Development / Test (3 orgs, 17 users)

Seed file: `backend/src/shared/database/seeds/development/001_seed_data.ts`

| Org | OT Rules | Tier | Integrations | Users |
|-----|----------|------|-------------|-------|
| **GreenWaste Solutions** | Federal (40h/week) | Professional | SMS | 1 admin, 1 manager, 1 payroll, 3 drivers |
| **Metro Disposal Co** | California (8h/day + 12h DT) | Professional | SMS, QuickBooks | 1 admin, 1 manager, 2 drivers |
| **Sunrise Sanitation** | Federal | Free | None | 1 admin, 2 drivers |

**Data generated:**
- 6 weeks of clock entries with realistic patterns (split shifts, GPS coordinates, varied routes)
- 4 weeks of timesheets in mixed states (draft, submitted, approved)
- 5 projects per org: Residential Pickup, Commercial Pickup, Recycling Collection, Bulk Waste Removal, Yard Maintenance
- 7 routes: RES-01, RES-02, COM-01, COM-02, RCY-01, BLK-01, YRD-01
- 5 shift templates with project-route mappings and default shift times
- 2 weeks of schedules (current + next) including weekend shifts
- Work zones with GPS (depots, transfer stations, landfills)
- Time-off requests (PTO, sick, personal, jury duty) in pending/approved states
- Time-off balances (PTO 80h, sick 40-48h, personal 24h per driver)
- Audit log alerts (midnight auto-close, missing clock-in)
- Drivers currently clocked in for live dashboard demo
- **Always re-seeds** (drops and recreates data on each run)

### Production (5 orgs, 24 users)

Seed file: `backend/src/shared/database/seeds/production/001_seed_data.ts`

| Org | OT Rules | Tier | Integrations | Users |
|-----|----------|------|-------------|-------|
| **GreenWaste Solutions** | Federal | Professional | SMS, QB, custom domain | 1 admin, 1 manager, 1 payroll, 6 drivers |
| **Metro Disposal Co** | California | Professional | SMS, QB | 1 admin, 1 manager, 3 drivers |
| **Sunrise Sanitation** | Federal | Free | None | 1 admin, 2 drivers |
| **Pacific Waste Management** | California | Enterprise | SMS, IVR, QB, dispatcher API | 1 admin |
| **EcoHaul Services** | Federal | Medium | SMS | 1 admin |

**Same generated data as dev**, plus:
- OT workflow enabled on GreenWaste and Pacific Waste
- Custom domain: `time.greenwaste.com` on GreenWaste
- IVR enabled on Pacific Waste
- Dispatcher API URL on Pacific Waste
- Hazardous Waste project on Metro Disposal
- **Safe to re-run** (skips if orgs already exist)

### Running Seeds

```bash
# Development (default)
cd backend && npx knex seed:run --knexfile src/shared/database/knexfile.ts

# Production (first deploy only — skips if data exists)
NODE_ENV=production npx knex seed:run --knexfile src/shared/database/knexfile.ts
```

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
