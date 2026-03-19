---
name: find-skills
description: Project context skill for ServiceCore — waste services employee time tracking platform
---

# ServiceCore Project Context

## Context
White-label SaaS platform for waste services companies to track employee time via app, SMS, and IVR with offline-first design and multi-tenant isolation.

## Codebase
- **Target:** 50,000+ employees across 100+ companies
- **Structure:** Angular 17 frontend (web + PWA) + Node.js/TypeScript microservices backend
- **Monorepo/Multi-repo:** TBD (PRD suggests separate repos: waste-time-tracker, waste-api, waste-infra)

## Stack
- Angular 17 (standalone components, lazy loading, PWA)
- NgRx (state management)
- Service Workers + IndexedDB (offline-first)
- Socket.io (real-time WebSocket)
- Node.js + TypeScript (backend)
- 6 Microservices: Auth, Time Tracking, Dispatcher, Payroll, Notifications, Integration
- PostgreSQL with Row-Level Security (multi-tenant)
- PgBouncer (connection pooling)
- Redis / ElastiCache (caching)
- AWS SQS FIFO (async job queue)
- Twilio (SMS/IVR)
- SendGrid (email)
- QuickBooks API (payroll)
- Stripe (billing)
- AWS: ECS/Fargate, RDS, ElastiCache, S3, CloudFront, ALB, CloudWatch
- Jasmine/Karma (unit tests) + Cypress (E2E)
- Docker (containerization)
- Terraform/CloudFormation (IaC)

## Key Files
- `docs/PRD.md` — Product requirements, features, acceptance criteria
- `docs/TASK_LIST.md` — Phased task breakdown (MVP → Polish → Final)
- `docs/TECH_STACK.md` — Full stack decisions, schema DDL, cost estimates
- `docs/USER_FLOW.md` — User journeys, API endpoints, example queries
- `docs/MEMO.md` — Architecture decisions with rationale
- `docs/ERROR_FIX_LOG.md` — Error tracking with category prefixes
- `.env` — Environment variable template
- `.cursor/rules/tech-stack-lock.mdc` — Locked technology decisions
- `.cursor/rules/env-files-read-only.mdc` — Env file protection rules
- `.cursor/rules/error-resolution-log.mdc` — Error logging rules

## Processing Strategy
1. Clock event received (app tap / SMS "IN" / IVR press 1)
2. If online: POST to API → validate org_id + user_id → write PostgreSQL → WebSocket push to manager dashboard → queue confirmation
3. If offline: store in IndexedDB with idempotency key → auto-sync on reconnect → server deduplicates
4. Weekly: aggregate clock_entries into timesheets → Friday auto-submit → manager approval → lock → nightly QB batch push

## Known Patterns
- org_id on EVERY database table and EVERY API query (multi-tenant isolation)
- Idempotency keys on clock_entries for offline deduplication
- Last-write-wins conflict resolution for sync
- JWT (1hr) + refresh tokens (7-day, httpOnly cookie)
- API response format: `{success, data, timestamp}`
- SQS for all async work (email, SMS, payroll) — never block API
- 120px button height, 24pt font for gloves-friendly UX

## Post-Execution
After this skill completes, if execution failed or produced errors:
1. Run `/skill-lifecycle observe find-skills` to record the failure
2. If the error involved data loss or contradicted skill instructions, add `--critical`
