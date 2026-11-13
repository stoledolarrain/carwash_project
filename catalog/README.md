# Catalog Service

Microservicio del catálogo de servicios de lavado de la **Plataforma de Gestión para Car Wash** (Ingeniería Web III).

## Responsabilidad

Administrar el catálogo de servicios: servicios disponibles, descripciones, precios, tiempos estimados y disponibilidad (activo/inactivo). Publica eventos del catálogo hacia Kafka y expone consultas REST para otros servicios.

No gestiona órdenes, clientes, pagos, notificaciones ni autenticación.

> **Estado:** configuración inicial (Paso 3). La lógica del catálogo, PostgreSQL y Kafka todavía no están implementados. Solo existe `GET /health`.

## Tecnologías

- JavaScript (CommonJS) sobre Node.js
- Express 5
- PostgreSQL (`pg`, SQL explícito), previsto
- Apache Kafka (`kafkajs`), previsto
- `dotenv` para variables de entorno
- Jest y Supertest para pruebas
- `nodemon` para desarrollo

## Arquitectura

Clean Architecture + DDD + CQRS, en `src/`:

| Capa | Carpeta |
|---|---|
| Dominio | `src/domain` |
| Aplicación (commands, queries, puertos) | `src/application` |
| Infraestructura (PostgreSQL, Kafka) | `src/infrastructure` |
| Presentación (Express) | `src/presentation` |

`src/container.js` es el *composition root*; `src/app.js` crea la aplicación Express sin llamar a `listen` (el arranque está en `index.js`).

## Instalación

```bash
cd catalog
npm install
cp .env.example .env   # en PowerShell: Copy-Item .env.example .env
```

## Ejecución

```bash
npm start      # producción
npm run dev    # desarrollo con recarga (nodemon)
```

Comprobación: `GET http://localhost:3002/health`

## Pruebas

```bash
npm test
npm run test:coverage
```

## Variables de entorno

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `PORT` | Puerto HTTP | `3002` |
| `NODE_ENV` | Entorno | `development` |
| `DATABASE_URL` | Cadena de conexión a PostgreSQL (`catalog_db`) | sin valor |
| `KAFKA_BROKERS` | Brokers separados por comas | `localhost:9092` |
| `KAFKA_CLIENT_ID` | Identificador del cliente Kafka | `catalog-service` |
| `KAFKA_GROUP_ID` | Grupo de consumidores | `catalog-service-group` |

No se deben subir credenciales reales: `.env` está en `.gitignore`.
