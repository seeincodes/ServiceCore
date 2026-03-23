# Backend

Node.js/Express API server for TimeKeeper, structured as a modular microservices architecture.

## Tech Stack

| Category | Technology | Version |
|----------|-----------|---------|
| **Runtime** | Node.js | 20 LTS |
| **Framework** | Express | 5.2.1 |
| **Language** | TypeScript | 5.9.3 |
| **Database** | PostgreSQL | 15+ |
| **Query Builder** | Knex | 3.1.0 |
| **Cache** | Redis (ioredis) | 5.10.1 |
| **Real-time** | Socket.io | 4.8.3 |
| **Auth** | JWT (jsonwebtoken) + bcrypt | 9.0.3 / 6.0.0 |
| **Validation** | Zod | 4.3.6 |
| **Logging** | Winston | 3.19.0 |
| **SMS** | Twilio | 5.13.0 |
| **Email** | SendGrid | 8.1.6 |
| **Cloud** | AWS SDK (SQS, S3, CloudWatch) | 2.1693.0 |
| **PDF Export** | PDFKit | 0.18.0 |
| **Excel Export** | ExcelJS | 4.4.0 |
| **Security** | Helmet, CORS, express-rate-limit | - |
| **Testing** | Jest + ts-jest | 30.3.0 |
| **Linting** | ESLint + Prettier | 9.0.0 / 3.8.1 |
| **Containerization** | Docker (multi-stage, Node Alpine) | - |

## Development server

Run `npm run dev` to start the dev server with hot reload via ts-node-dev.

## Build

Run `npm run build` to compile TypeScript. Output goes to `dist/`.

## Running tests

Run `npm test` to execute tests via Jest.
