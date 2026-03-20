# Deployment Runbook
## TimeKeeper — Waste Services Time Tracking Platform

---

## Prerequisites

- AWS CLI configured with appropriate IAM credentials
- Terraform >= 1.5 installed
- Docker installed
- Node.js 20 LTS

---

## Local Development

```bash
# 1. Start databases
docker-compose up -d postgres redis

# 2. Install dependencies
cd backend && npm install
cd ../frontend && npm install

# 3. Run migrations and seed
cd backend
npx knex migrate:latest --knexfile src/shared/database/knexfile.ts
npx knex seed:run --knexfile src/shared/database/knexfile.ts

# 4. Start services
cd backend && npm run dev      # API on :3000
cd frontend && npx ng serve    # Frontend on :4200
```

**Local ports:** PostgreSQL 5433, Redis 6380, API 3000, Frontend 4200

---

## Production Deployment

### First-Time Setup

```bash
# 1. Initialize Terraform
cd infra
terraform init

# 2. Plan and apply infrastructure
terraform plan -var="db_password=<SECURE_PASSWORD>"
terraform apply -var="db_password=<SECURE_PASSWORD>"

# 3. Build and push Docker image
aws ecr get-login-password | docker login --username AWS --password-stdin <ACCOUNT>.dkr.ecr.us-east-1.amazonaws.com
docker build -t timekeeper-api ./backend
docker tag timekeeper-api:latest <ACCOUNT>.dkr.ecr.us-east-1.amazonaws.com/timekeeper-api:latest
docker push <ACCOUNT>.dkr.ecr.us-east-1.amazonaws.com/timekeeper-api:latest

# 4. Run migrations (via ECS exec or bastion)
# Connect to an ECS task and run:
npx knex migrate:latest --knexfile src/shared/database/knexfile.ts
npx knex seed:run --knexfile src/shared/database/knexfile.ts

# 5. Deploy ECS service
aws ecs update-service --cluster timekeeper-cluster --service timekeeper-api --force-new-deployment
```

### Subsequent Deploys

Pushes to `master` trigger the CI/CD pipeline automatically:
1. Backend tests run (with PostgreSQL + Redis services)
2. Frontend builds and tests
3. Docker image built, tagged with commit SHA, pushed to ECR
4. ECS service updated with rolling deployment

### Rollback

```bash
# Roll back to previous task definition
aws ecs update-service \
  --cluster timekeeper-cluster \
  --service timekeeper-api \
  --task-definition timekeeper-api:<PREVIOUS_REVISION>
```

---

## Environment Variables

Set in AWS SSM Parameter Store (`/timekeeper/production/*`):

| Variable | SSM Path | Required |
|----------|----------|----------|
| DATABASE_URL | /timekeeper/production/DATABASE_URL | Yes |
| REDIS_URL | /timekeeper/production/REDIS_URL | Yes |
| JWT_SECRET | /timekeeper/production/JWT_SECRET | Yes |
| TWILIO_ACCOUNT_SID | Set in task definition env | For SMS |
| TWILIO_AUTH_TOKEN | Set in task definition secrets | For SMS |
| SENDGRID_API_KEY | Set in task definition secrets | For email |
| STRIPE_SECRET_KEY | Set in task definition secrets | For billing |

---

## Monitoring

### CloudWatch Alarms
- **API CPU > 85%** — auto-scales ECS tasks
- **5xx errors > 10 in 5min** — alerts on-call

### Logs
- API logs: `/ecs/timekeeper-api` in CloudWatch Logs
- Retention: 30 days

### Health Check
- `GET /health` — returns `{ status: "ok", timestamp }` (used by ALB + ECS)

---

## Database Operations

### Run Migration
```bash
aws ecs execute-command --cluster timekeeper-cluster \
  --task <TASK_ID> --container api --interactive \
  --command "npx knex migrate:latest --knexfile src/shared/database/knexfile.ts"
```

### Backup
- Automated daily backups via RDS (30-day retention)
- Multi-AZ failover enabled

### Connection Pooling
- PgBouncer runs as sidecar in ECS task
- Transaction pooling mode, 25 connections per pool
- Max 200 client connections
