# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

University project (Ingeniería Web III): a car wash management platform built as a **microservices monorepo**. Each top-level folder is an independent Node.js package with its own `package.json`, `node_modules`, and database. There is no root `package.json` and no workspace tooling: always `cd` into the service before running npm.

Code, comments, READMEs, commit messages, and test descriptions are written in **Spanish**. Keep that convention.

| Folder | Status | Stack |
|---|---|---|
| `catalog/` | Complete, fully tested | Express 5, PostgreSQL (`pg`), Kafka (`kafkajs`), Jest + supertest |
| `identity/` | Complete, tested, persisted in PostgreSQL | Express 5, PostgreSQL (`pg`), bcryptjs, jsonwebtoken, Jest + supertest |
| `customer/` | Complete, tested; verifies Identity JWTs | **Python** Django 5 + DRF, PostgreSQL (`customer_db`), confluent-kafka, pytest |
| `wash_order/` | Working; verifies Identity JWTs + per-action roles | Express 5, PostgreSQL (`pg`), Kafka producer (`kafkajs`), plain `node:assert` script |
| `payment/` | Working; verifies Identity JWTs (Spring Security) | **Java 21** Spring Boot 4, JPA + PostgreSQL, Maven wrapper |
| `notification/` | Working; verifies Identity JWTs; no tests | Express 5, PostgreSQL (`pg`) |

Every service now verifies Identity's HS256 JWT itself (same `JWT_SECRET`/`JWT_ISSUER`/`JWT_AUDIENCE` in every `.env`), so all of them refuse to start without `JWT_SECRET` except catalog (falls back to `DEV_AUTH_ROLE`) and customer (lenient outside production). Role sets follow Identity's permission lists in `identity/src/domain/value-objects/Role.js`.
| `api-gateway/` | Working, tested; routes all six services | Express 5, hand-written `node:http` proxy, jsonwebtoken, cors, Jest + supertest |
| `frontend/` | Vite + React 19 scaffold, untouched template | Vite, ESLint |

Ports (keep unique; every service reads `PORT` from its own `.env`): wash_order 3000, identity 3001, catalog 3002, payment 3003 (`server.port`), notification 3004, customer 3005, api-gateway 8080.

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
Copy-Item .env.example .env   # set DATABASE_URL (identity_db) and JWT_SECRET (>= 32 chars, mandatory)
npm run dev                   # or: npm start. Applies pending migrations, then seeds the ADMIN_EMAIL admin when no users exist
npm run migrate               # apply migrations/*.sql without starting the server
npm test
```
- Same layering and composition-root pattern as catalog (`src/container.js`, `createApp(container, { logRequests })`), with its own `tests/unit/architecture.test.js`.
- `buildPersistence(config)` in `container.js` picks `PgUserRepository` when `DATABASE_URL` is set (verifies the DB is literally `identity_db`, runs migrations on startup) and falls back to `InMemoryUserRepository` otherwise; the fallback is refused when `NODE_ENV=production`.
- Repository `save(user, { expectedVersion })`: `null` means INSERT, a number means UPDATE guarded by optimistic concurrency. Both implementations share one contract suite in `tests/integration/userRepository.contract.test.js`; its PostgreSQL half runs in a throwaway `identity_test_*` schema and is skipped when `DATABASE_URL` is unset. No outbox yet: events are only logged by `ConsoleEventPublisher`.
- Issues HS256 JWTs (`sub`, `role`, `tv`). `tv` is the user's `tokenVersion`, bumped on password/role change and deactivation, so `VerifyAccessToken` rejects older tokens. `POST /api/identity/auth/verify` exposes that check for the API Gateway.
- Roles are `ADMIN`, `RECEPTIONIST`, `WASHER` (`src/domain/value-objects/Role.js`, with permission lists). No public sign-up: only admins create users.
- `identity.postman_collection.json` runs end-to-end in order with the Collection Runner.

### api-gateway (port 8080)
```powershell
cd api-gateway
npm install
Copy-Item .env.example .env   # JWT_SECRET/ISSUER/AUDIENCE must match identity/.env exactly
npm run dev
npm test                      # uses an in-process fake upstream; identity need not be running
```
- Single entry point for the frontend. Route table lives in `src/config/services.js` (prefix, target URL from env, `publicRoutes`, `blockedRoutes`, optional `healthPath`; rule paths accept `:param` segments); adding a service means one entry there plus its URL in `src/config/env.js`. Prefixes: `/api/identity`, `/api/catalog`, `/api/customer`, `/api/orders` (wash_order), `/api/payments`, `/api/notifications`.
- Default-deny: every route under a service prefix requires a valid HS256 JWT (signature, `exp`, `iss`, `aud`) unless listed in `publicRoutes` (login, catalog's public GETs). Unknown `/api/*` paths and `blockedRoutes` return 404: identity `POST /auth/verify`, catalog `POST /services/batch`, `POST /api/notifications` — these are service-to-service calls made directly, not through the gateway.
- `/health/services` probes each service's `healthPath` (payment's is `/api/payments/health`).
- Tests start one in-process fake per service and point every `*_SERVICE_URL` at them, so they never hit services running locally.
- `src/proxy/serviceProxy.js` is a hand-written `node:http` proxy: deliberately no `express.json()` (bodies stream through untouched), full path preserved, `Authorization` forwarded, `X-Forwarded-For` overwritten with the socket address. `http-proxy-middleware` v4 was rejected because it is ESM-only and this repo is CommonJS.
- Downstream services must still verify the JWT themselves; the gateway does not inject identity headers. Identity needs `TRUST_PROXY=1` behind the gateway so its login rate limit sees client IPs.

### wash_order (port 3000)
```powershell
cd wash_order
npm install
npm start
npm test        # runs test.js: a plain node:assert script that boots the app and WRITES to the real DB
```
`require('dotenv')` must stay the first line of `index.js`/`test.js`: `src/infrastructure/database/postgres.js` builds its pool from `process.env` at module load. The table is created lazily by `inicializarBaseDatos()` on first repository call.
Auth: `src/app.js` mounts `infrastructure/security/autenticacionJwt.js` on all of `/api/orders` (throws at require time without `JWT_SECRET`); `presentation/middlewares/requerirRol.js` sets roles per route — read: all roles; create and `/start`: ADMIN/RECEPTIONIST; `/complete`: + WASHER; `/deliver`: ADMIN/RECEPTIONIST. `test.js` signs its own tokens (falls back to a test secret when `.env` has none).

### customer (port 3005)
```powershell
cd customer
python -m venv .venv; .venv\Scripts\activate
pip install -r requirements-dev.txt
python manage.py migrate
python manage.py runserver 3005
pytest tests/unit                 # no DB needed
pytest -m integration             # needs customer_db
python manage.py consume_order_events   # Kafka consumer of wash-order.order.events (separate process)
python manage.py publish_outbox         # outbox worker (separate process)
```

### payment (port 3003) / notification (port 3004)
```powershell
cd payment; .\mvnw.cmd spring-boot:run      # run FROM payment/: reads payment/.env (PORT, DB_*, NOTIFICATION_URL)
cd notification; npm install; node index.js  # reads notification/.env (PORT, DB_*)
```
Payment is Spring Boot, which does not read `.env` natively: `application.properties` pulls it in with `spring.config.import=optional:file:.env[.properties]` (path relative to the working directory). Real environment variables, e.g. from `docker-compose.yml`, override it.
Each has its own `docker-compose.yml` with a dedicated Postgres container (both now demand `JWT_SECRET` via `${JWT_SECRET:?...}`). Payment notifies Notification over direct HTTP (`NOTIFICATION_URL`), not Kafka, forwarding the caller's JWT taken from the Spring `SecurityContext`; Notification only accepts ADMIN/RECEPTIONIST.
Payment security: `infrastructure/security/SecurityConfig.java` (OAuth2 resource server, `NimbusJwtDecoder` HS256 + issuer/audience/role validators, JSON 401/403). `PaymentSecurityTest` is a `@WebMvcTest` that needs no DB (`.\mvnw.cmd test -Dtest=PaymentSecurityTest`); the default `contextLoads` test still needs a real DB and `JWT_SECRET`. Spring Boot 4 moved test annotations: `org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest`, `org.springframework.test.context.bean.override.mockito.MockitoBean`.

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
Admin routes trust only `req.auth = { userId, role | roles }`. Nothing reads client headers like `X-User-Role`; that is deliberate and must stay so. `index.js` picks the auth source: with `JWT_SECRET` set it injects `src/infrastructure/security/jwtAuthContext.js` (verifies Identity's HS256 JWT, no header → no `req.auth`, bad token → 401); otherwise, outside production, `DEV_AUTH_ROLE` injects a fixed role. It lives in infrastructure (it depends on `jsonwebtoken`) and reaches the app only through `createApp`'s `authContextMiddleware`, so presentation code never imports it. Tests: `tests/integration/jwtAuth.test.js`.

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
