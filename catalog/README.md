# Catalog Service

Microservicio del catálogo de servicios de lavado de la **Plataforma de Gestión para Car Wash** (Ingeniería Web III).

## Responsabilidad

Administrar el catálogo de servicios: servicios disponibles, descripciones, precios, tiempos estimados y disponibilidad (activo/inactivo). Persiste los servicios y sus eventos en PostgreSQL mediante el patrón **Transactional Outbox**, publica eventos hacia Kafka y expone consultas REST para otros servicios.

No gestiona órdenes, clientes, pagos, notificaciones ni autenticación.

> **Estado:** capas `Domain`, `Application` (CQRS) e `Infrastructure` (PostgreSQL + Transactional Outbox) implementadas. La capa `Presentation` (endpoints REST del catálogo) y el publicador Kafka se implementan en los pasos siguientes.

## Tecnologías

- JavaScript (**CommonJS**: `require` / `module.exports`) sobre Node.js 24
- Express 5
- PostgreSQL 18 (`pg`, consultas SQL explícitas parametrizadas, sin ORM)
- Apache Kafka (`kafkajs`), previsto
- `dotenv` para variables de entorno
- Jest y Supertest para pruebas unitarias y de integración
- `nodemon` para desarrollo

## Arquitectura

Clean Architecture + DDD + CQRS, en `src/`:

| Capa | Carpeta | Contenido |
|---|---|---|
| Dominio | `src/domain` | `WashService`, objetos de valor (`ServiceName`, `Money`, `Duration`), eventos y errores de dominio |
| Aplicación | `src/application` | Commands, Queries, DTOs, errores y puertos (`ServiceRepository`, `UnitOfWork`, `EventPublisher`) |
| Infraestructura | `src/infrastructure` | `pg.Pool`, migraciones SQL, `PgServiceRepository`, `PgOutboxRepository` y `PgUnitOfWork` |
| Presentación | `src/presentation` | Express 5, `GET /health` y manejo centralizado de errores |

`src/container.js` es el *composition root*; `src/app.js` crea la aplicación Express sin llamar a `listen` (el arranque está en `index.js`).

## Configuración de PostgreSQL 18

1. Asegúrate de tener **PostgreSQL 18** en ejecución en `localhost:5432` y la base de datos `catalog_db` creada.
2. Copia el archivo de ejemplo y configura tus credenciales locales en `.env` (excluido de Git mediante `.gitignore`):

```powershell
cd catalog
Copy-Item .env.example .env
```

3. Edita `.env` con tu usuario y contraseña locales de PostgreSQL:

```env
NODE_ENV=development
PORT=3002
DATABASE_URL=postgresql://postgres:TU_CONTRASEÑA@localhost:5432/catalog_db
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=catalog-service
KAFKA_GROUP_ID=catalog-service-group
```

## Instalación y Migraciones

```powershell
cd catalog
npm install
npm run migrate
```

El script `npm run migrate` verifica que la conexión apunte a `catalog_db`, crea la tabla de control `schema_migrations` y aplica de forma transaccional e idempotente los archivos de `migrations/` (`wash_services` y `outbox_events`), sin borrar ni reiniciar datos existentes.

## Ejecución del servicio

```powershell
npm start      # producción
npm run dev    # desarrollo con recarga (nodemon)
```

Comprobación: `GET http://localhost:3002/health`

## Pruebas

```powershell
npm test
npm run test:coverage
```

Las pruebas de integración con PostgreSQL crean un `SCHEMA` temporal aislado dentro de PostgreSQL y lo eliminan al finalizar (`DROP SCHEMA ... CASCADE`), garantizando que las tablas y datos del schema `public` de `catalog_db` nunca se borren ni se alteren durante los tests.

## Variables de entorno

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `NODE_ENV` | Entorno de ejecución | `development` |
| `PORT` | Puerto HTTP del microservicio | `3002` |
| `DATABASE_URL` | Cadena de conexión a PostgreSQL (`catalog_db`) | requerido para persistencia |
| `KAFKA_BROKERS` | Lista de brokers de Kafka separados por comas | `localhost:9092` |
| `KAFKA_CLIENT_ID` | Identificador del cliente Kafka | `catalog-service` |
| `KAFKA_GROUP_ID` | Identificador del grupo de consumidores Kafka | `catalog-service-group` |

No se deben subir credenciales reales: `.env` está en `.gitignore`.
