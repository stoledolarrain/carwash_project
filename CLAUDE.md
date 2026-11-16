# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

University project (Ingeniería Web III): a car wash management platform built as a **microservices monorepo**. Each top-level folder is an independent Node.js package with its own `package.json`, `node_modules`, and database. There is no root `package.json` and no workspace tooling: always `cd` into the service before running npm.

Code, comments, READMEs, commit messages, and test descriptions are written in **Spanish**. Keep that convention.

| Folder | Status | Stack |
|---|---|---|
| `catalog/` | Complete, fully tested | Express 5, PostgreSQL (`pg`), Kafka (`kafkajs`), Jest + supertest |
| `identity/` | Complete, tested; in-memory persistence (PostgreSQL pending) | Express 5, bcryptjs, jsonwebtoken, Jest + supertest |
| `wash_order/` | Working prototype | Express 5, built-in `node:sqlite`, in-process EventEmitter |
| `api-gateway/` | Only `package.json` exists (untracked) | Express 5 |
| `frontend/` | Vite + React 19 scaffold, untouched template | Vite, ESLint |

Planned but not yet started: Customer/Vehicle, Payment, Notification services (see root `README.md`).

## Commands

### catalog (port 3002)
```powershell
cd catalog
npm install
Copy-Item .env.example .env   # then set DATABASE_URL to a local catalog_db
npm run migrate               # applies migrations/*.sql idempotently (tracked in schema_migrations)
npm start                     # or: npm run dev (nodemon)
npm run dev:admin             # same, with DEV_AUTH_ROLE=ADMIN so /api/catalog/admin/* work locally
npm test
npm run test:coverage
npx jest tests/unit/domain/WashService.test.js      # single file
npx jest -t "nombre del test"                       # by test name
npx jest tests/unit                                 # unit only (no DB needed)
```
- Unit tests (`tests/unit`) and `tests/integration/catalogApi.test.js` / `health.test.js` run without any infrastructure (in-memory repository + fake publisher).
- `tests/integration/postgresCatalog.test.js` and `outboxKafka.test.js` need a real PostgreSQL with a database literally named `catalog_db` reachable via `DATABASE_URL`. They create a throwaway schema per run and drop it; they never touch `public`. Kafka itself is **not** needed: the Kafka producer is stubbed.
- The service refuses to connect to any database not named `catalog_db` (`EXPECTED_DATABASE` in `src/infrastructure/database/pool.js`).
- `catalog.http` (VS Code REST Client) and `catalog.postman_collection.json` hold ready-made requests.

### identity (port 3001)
```powershell
cd identity
npm install
Copy-Item .env.example .env   # JWT_SECRET (>= 32 chars) is mandatory: the service refuses to start without it
npm run dev                   # or: npm start. Seeds the ADMIN_EMAIL/ADMIN_PASSWORD admin when no users exist
npm test                      # no infrastructure needed
```
- Same layering and composition-root pattern as catalog (`src/container.js`, `createApp(container, { logRequests })`), with its own `tests/unit/architecture.test.js`.
- Persistence is `InMemoryUserRepository` behind the `UserRepository` port; data is lost on restart. The PostgreSQL repository should implement the same port and be swapped in only in `container.js`.
- Issues HS256 JWTs (`sub`, `role`, `tv`). `tv` is the user's `tokenVersion`, bumped on password/role change and deactivation, so `VerifyAccessToken` rejects older tokens. `POST /api/identity/auth/verify` exposes that check for the API Gateway.
- Roles are `ADMIN`, `RECEPTIONIST`, `WASHER` (`src/domain/value-objects/Role.js`, with permission lists). No public sign-up: only admins create users.
- `identity.postman_collection.json` runs end-to-end in order with the Collection Runner.

### wash_order (port 3000)
```powershell
cd wash_order
npm install
npm start
npm test        # runs test.js: a plain node:assert script that boots the app on a random port
```
Requires Node ≥ 22 for `node:sqlite`. The DB file `src/infrastructure/database/wash_orders.sqlite` is created on first run.

### frontend
```powershell
cd frontend
npm install
npm run dev
npm run build
npm run lint
```

## Architecture

### Layering (enforced in catalog by a test)
Both backend services follow Clean Architecture + DDD + CQRS with the same four folders under `src/`: `domain/`, `application/` (split into `commands/` and `queries/`), `infrastructure/`, `presentation/`.

`catalog/tests/unit/architecture.test.js` scans `require()` calls and fails if:
- `domain/` imports from application/infrastructure/presentation or from express/pg/kafkajs/dotenv;
- `application/` imports from infrastructure/presentation or any of those libraries;
- `presentation/` imports from infrastructure, pg, or kafkajs.

Application defines ports (`application/ports/*.js`); infrastructure implements them. New code must respect this or the suite goes red.

### catalog: how a write request flows
1. `presentation/routes/catalogRoutes.js` → `catalogValidators` (HTTP edge validation) → `requireRole('ADMIN')` for `/api/catalog/admin/*` → `CatalogController`.
2. Controller calls a command in `application/commands/`. Commands load the `WashService` aggregate, mutate it (value objects `ServiceName`, `Money`, `Duration` validate invariants), and the aggregate queues domain events.
3. `application/support/persistAndPublish.js` is the single place that saves: with a `UnitOfWork` it writes the aggregate **and** its events to `outbox_events` in one PostgreSQL transaction (Transactional Outbox). If the aggregate produced no events (idempotent no-op), nothing is written and `version` is not bumped.
4. `infrastructure/messaging/OutboxWorker.js` polls `outbox_events` (`FOR UPDATE SKIP LOCKED`) and publishes to Kafka topics `catalog.service.*`. At-least-once delivery; consumers dedupe on `eventId`. Kafka being down only delays publication.
5. Errors propagate as typed classes (`domain/errors/DomainErrors.js`, `application/errors/ApplicationErrors.js`) and are mapped to HTTP in `presentation/middlewares/errorHandler.js` (400 domain/validation, 404 not found, 409 duplicate name / optimistic-concurrency conflict / already active-inactive). Response shape is always `{ error: { code, message, details? } }`.

### catalog: composition root and testability
`src/container.js` is the only place concrete dependencies are wired. Every dependency is lazily resolved and can be overridden by passing it in (`buildContainer({ repository, eventPublisher, pool, ... })`). `src/app.js` builds the Express app without listening and accepts `options.authContextMiddleware`, which is how tests and `index.js` inject `req.auth`. Reuse this pattern instead of mocking modules.

### catalog: auth model
Admin routes trust only `req.auth = { userId, role | roles }`. Nothing reads client headers like `X-User-Role`; that is deliberate and must stay so. In development, `DEV_AUTH_ROLE` (ignored when `NODE_ENV=production`) makes `index.js` inject a fixed auth context. The future API Gateway / Identity Service is expected to populate `req.auth` after JWT verification; controllers and use cases should not change for that.

### wash_order
- `domain/states/OrderState.js` implements the **State pattern** for the order lifecycle `EN_ESPERA → EN_PROCESO → LISTO → ENTREGADO`. Transitions happen only via the state classes; invalid transitions throw.
- Wiring is done inline in `presentation/routes/orderRoutes.js` (no container). Commands receive the SQLite repository and `busEventos`.
- `infrastructure/events/eventEmitter.js` wraps every emitted event in the same envelope shape catalog uses (`eventId`, `evento`, `eventVersion`, `fechaEmision`, `aggregateId`, `datos`) and optionally POSTs it to `NOTIFICATION_SERVICE_URL`. It is an in-process bus, not Kafka, so this is the first place to touch when migrating wash_order to the broker.
- Order creation currently takes free-form service codes and a client-supplied `precioTotal`; the intended integration is to validate/price against catalog's `POST /api/catalog/services/batch` (`{ ids, onlyActive: true }` → `{ services, notFound }`).

### Cross-service conventions
- Each service owns its database (`catalog_db`, SQLite file for wash_order). Never query another service's tables.
- Event envelope fields are shared across services; keep `eventVersion` and topic names (`catalog.service.created|updated|price-changed|activated|deactivated`) stable.
- Catalog's `README.md` is the authoritative, detailed spec for its endpoints, DTOs, env vars, and event payloads. Read it before changing the API.

## Project skills

`.claude/skills-backend/*/SKILL.MD` contains the team's architectural guidelines (clean-architecture, cqrs-pattern, ddd-domain-design, event-driven-architecture, microservices-persistence, microservices-testing, rest-api-design, api-gateway, backend-security, backend-observability, solid-design-patterns). They are written in Spanish and describe what the grading rubric expects. Consult the relevant one when creating a new service or adding a layer; they are not auto-loaded as slash skills. `.claude/skills/` holds general frontend/design skills.
