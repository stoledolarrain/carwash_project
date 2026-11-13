# Catalog Service — Microservicio de Catálogo de Servicios de Lavado

Microservicio responsable de la gestión del catálogo de servicios de lavado dentro de la **Plataforma de Gestión para Car Wash** (Ingeniería Web III).

---

## 1. Responsabilidad del Microservicio

**Catalog Service** es la fuente única de verdad (*Single Source of Truth*) del catálogo de servicios de lavado del Car Wash. Su contexto acotado (*Bounded Context*) comprende:

- Administrar el ciclo de vida de los servicios de lavado (`WashService`): creación, actualización de nombre/descripción/duración estimada, cambio de precio, activación y desactivación.
- Exponer consultas públicas de servicios activos, consulta individual por identificador y consulta por lote (`POST /api/catalog/services/batch`) para que otros microservicios (como **Wash Order Service**) validen servicios y obtengan precios/tiempos oficiales al crear una orden.
- Exponer endpoints administrativos protegidos por rol (`ADMIN`) para gestionar el catálogo completo (incluyendo servicios inactivos).
- Persistir transaccionalmente el estado del catálogo y sus eventos de dominio en PostgreSQL (`catalog_db`) mediante el patrón **Transactional Outbox** y publicar asíncronamente dichos eventos hacia **Apache Kafka** mediante `OutboxWorker`.

**Límites del dominio (lo que NO hace Catalog Service):**
- No gestiona órdenes de lavado (`wash_order`), clientes, vehículos, pagos, facturación ni notificaciones.
- No emite ni administra credenciales o tokens JWT (responsabilidad de **Identity Service** y **API Gateway**).

---

## 2. Arquitectura y Estructura de Carpetas

El microservicio implementa **Clean Architecture** (4 capas concéntricas), **Domain-Driven Design (DDD)**, **CQRS** (*Command Query Responsibility Segregation*) y **Transactional Outbox**, respetando estrictamente la regla de dependencia (`Presentation -> Application -> Domain` e `Infrastructure -> Application -> Domain`):

| Capa | Directorio | Responsabilidad |
|---|---|---|
| **Domain** | `src/domain/` | Reglas de negocio puras sin dependencias externas: entidad raíz de agregado `WashService`, Value Objects inmutables (`ServiceName`, `Money`, `Duration`), eventos de dominio (`ServiceEvents`) y errores de dominio (`DomainErrors`). |
| **Application** | `src/application/` | Casos de uso segregados mediante **CQRS** (`commands/` para escritura y `queries/` para lectura), contratos/puertos (`ServiceRepository`, `UnitOfWork`, `EventPublisher`), DTOs (`ServiceDto`), validadores de casos de uso y soporte transaccional (`persistAndPublish`). |
| **Infrastructure** | `src/infrastructure/` | Implementación técnica de puertos: conexión `pg.Pool`, corredor de migraciones SQL, `PgUnitOfWork`, `PgServiceRepository`, `PgOutboxRepository` (con `FOR UPDATE SKIP LOCKED`), `KafkaEventPublisher` y `OutboxWorker`. |
| **Presentation** | `src/presentation/` | API HTTP con Express 5: rutas (`/api/catalog`, `/health`), `CatalogController`, validadores de borde HTTP (`catalogValidators`) y middlewares (`requireRole`, `errorHandler`). |

### Estructura del proyecto `catalog/`

```text
catalog/
├── index.js                                        # Punto de entrada: verifica BD, levanta servidor HTTP, inicia OutboxWorker y gestiona cierre ordenado
├── package.json                                    # Configuración CommonJS, scripts y dependencias
├── jest.config.js                                  # Configuración de pruebas unitarias e integración
├── .env.example                                    # Plantilla de variables de entorno (sin credenciales reales)
├── .gitignore                                      # Archivos ignorados por Git (incluye .env, node_modules, coverage)
├── catalog.http                                    # Colección de pruebas manuales para VS Code REST Client
├── catalog.postman_collection.json                 # Colección Postman v2.1 con scripts de prueba y variables
├── migrations/
│   └── 001_create_catalog_tables.sql               # Esquema PostgreSQL: wash_services, outbox_events e índices
├── src/
│   ├── app.js                                      # Fábrica de la aplicación Express 5
│   ├── container.js                                # Composición e inyección manual de dependencias (DIP)
│   ├── config/
│   │   └── env.js                                  # Lectura, normalización y validación de variables de entorno
│   ├── domain/
│   │   ├── entities/
│   │   │   └── WashService.js                      # Agregado raíz con Factory Methods create() y restore()
│   │   ├── value-objects/
│   │   │   ├── ServiceName.js                      # Nombre validado (3..100 caracteres, trim y espacios colapsados)
│   │   │   ├── Money.js                            # Monto positivo (> 0, máx. 2 decimales, moneda BOB)
│   │   │   └── Duration.js                         # Duración estimada en minutos enteros (1..480)
│   │   ├── events/
│   │   │   └── ServiceEvents.js                    # Constructores de los 5 eventos de dominio y catálogo de tópicos
│   │   └── errors/
│   │       └── DomainErrors.js                     # Jerarquía de errores de dominio
│   ├── application/
│   │   ├── commands/                               # Escritura (CQRS): CreateService, UpdateService, ChangeServicePrice, ActivateService, DeactivateService
│   │   ├── queries/                                # Lectura (CQRS): GetActiveServices, GetAllServices, GetServiceById, GetServicesByIds
│   │   ├── dtos/
│   │   │   └── ServiceDto.js                       # Mapeo explícito de WashService a DTO de salida
│   │   ├── ports/                                  # Contratos abstractos: ServiceRepository, UnitOfWork, EventPublisher
│   │   ├── errors/
│   │   │   └── ApplicationErrors.js                # Errores de aplicación (400, 401, 403, 404, 409)
│   │   └── support/
│   │       ├── persistAndPublish.js                # Orquestador de guardado atómico de entidad + outbox_events
│   │       └── requestValidation.js                # Utilidades de validación de UUID y entrada en Application
│   ├── infrastructure/
│   │   ├── database/
│   │   │   ├── pool.js                             # Singleton getPool() y verificación de conexión a catalog_db
│   │   │   ├── migrate.js                          # Ejecutor idempotente de migraciones SQL con schema_migrations
│   │   │   └── PgUnitOfWork.js                     # Transacciones PostgreSQL (BEGIN / COMMIT / ROLLBACK)
│   │   ├── repositories/
│   │   │   └── PgServiceRepository.js              # Persistencia SQL parametrizada y control optimista de versión
│   │   ├── outbox/
│   │   │   └── PgOutboxRepository.js               # Gestión de outbox_events con FOR UPDATE SKIP LOCKED y orden por aggregate_id
│   │   └── messaging/
│   │       ├── KafkaEventPublisher.js              # Publicador KafkaJS con Singleton getKafkaEventPublisher()
│   │       └── OutboxWorker.js                     # Worker periódico de despacho del Transactional Outbox a Kafka
│   └── presentation/
│       ├── controllers/
│       │   └── CatalogController.js                # Controlador HTTP desacoplado de SQL y Kafka
│       ├── routes/
│       │   ├── catalogRoutes.js                    # Rutas públicas (/api/catalog/*) y administrativas (/api/catalog/admin/*)
│       │   └── healthRoutes.js                     # Endpoint GET /health
│       ├── validators/
│       │   └── catalogValidators.js                # Validación de borde HTTP (params, query y body)
│       └── middlewares/
│           ├── requireRole.js                      # Autorización por rol basada en contexto verificado req.auth
│           └── errorHandler.js                     # Traducción centralizada de errores a respuestas JSON consistentes
└── tests/
    ├── builders/
    │   └── WashServiceBuilder.js                   # Patrón GoF Builder para construcción fluida de datos de prueba
    ├── helpers/                                    # Dobles de prueba en memoria (InMemoryServiceRepository, FakeEventPublisher)
    ├── unit/                                       # Pruebas unitarias de Domain, Application, mensajería, entorno y arquitectura
    └── integration/                                # Pruebas de integración reales contra PostgreSQL 18, Supertest y Outbox->Kafka
```

### Patrones de Diseño GoF aplicados

1. **Factory Method (`WashService.create` y `WashService.restore`):** ubicados en `src/domain/entities/WashService.js`. Encapsulan la creación válida del agregado garantizando que nunca exista una instancia inválida en memoria y separando explícitamente una alta de negocio nueva (que inicia en `version = 1`, `isActive = true` y registra el evento `ServiceCreated`) de la reconstrucción desde PostgreSQL (que restaura el estado persistido sin emitir eventos).
2. **Singleton controlado (`getPool` y `getKafkaEventPublisher`):** ubicados en `src/infrastructure/database/pool.js` y `src/infrastructure/messaging/KafkaEventPublisher.js`. Garantizan una única instancia compartida del pool de conexiones PostgreSQL y del productor Kafka por proceso, con inicialización perezosa (*lazy*) para no abrir sockets durante la importación de módulos en pruebas unitarias.
3. **Builder (`WashServiceBuilder`):** ubicado en `tests/builders/WashServiceBuilder.js`. Proporciona una interfaz fluida (`WashServiceBuilder.aWashService().withName(...).withPrice(...).build()`) para construir agregados y cargas útiles en pruebas unitarias y de integración sin duplicar datos ni contaminar el código de producción.

---

## 3. Tecnologías y Requisitos Previos

### Tecnologías utilizadas
- **Lenguaje y módulo:** JavaScript sobre Node.js (**CommonJS**: `require` / `module.exports`).
- **Framework HTTP:** Express `^5.2.1`.
- **Base de datos:** PostgreSQL 18 mediante `pg` `^8.20.0` (consultas SQL explícitas y parametrizadas `$1, $2...`, sin ORM).
- **Mensajería asíncrona:** Apache Kafka mediante `kafkajs` `^2.2.4`.
- **Configuración:** `dotenv` `^17.4.2`.
- **Pruebas automatizadas:** `jest` `^30.3.0` y `supertest` `^7.2.2`.

### Requisitos previos en la máquina local
1. **Node.js 24** (o superior compatible con `>=20.0.0`) y `npm`.
2. **PostgreSQL 18** en ejecución (`localhost:5432`).
3. **Apache Kafka** en `localhost:9092` (opcional para levantar el servidor HTTP y operar la API REST: gracias al patrón **Transactional Outbox**, si Kafka no está disponible los eventos quedan almacenados de forma segura en la tabla `outbox_events` de PostgreSQL y se publican automáticamente en cuanto el broker esté activo).

---

## 4. Variables de Entorno

Copia el archivo de plantilla `.env.example` hacia `.env` dentro de `catalog/`:

```powershell
cd catalog
Copy-Item .env.example .env
```

Edita `catalog/.env` (archivo ignorado por Git mediante `.gitignore`) con tus credenciales locales de PostgreSQL:

| Variable | Descripción | Ejemplo / Valor por defecto |
|---|---|---|
| `NODE_ENV` | Entorno de ejecución (`development`, `test`, `production`) | `development` |
| `PORT` | Puerto HTTP donde escucha Catalog Service | `3002` |
| `DATABASE_URL` | Cadena de conexión a la base de datos exclusiva `catalog_db` | `postgresql://usuario:contraseña@localhost:5432/catalog_db` |
| `KAFKA_BROKERS` | Lista de brokers de Apache Kafka separados por comas | `localhost:9092` |
| `KAFKA_CLIENT_ID` | Identificador del cliente productor Kafka | `catalog-service` |
| `KAFKA_GROUP_ID` | Identificador de grupo Kafka | `catalog-service-group` |
| `OUTBOX_POLL_INTERVAL_MS` | Intervalo de sondeo del `OutboxWorker` en milisegundos | `5000` |
| `OUTBOX_BATCH_SIZE` | Cantidad máxima de eventos pendientes procesados por ciclo | `50` |
| `DEV_AUTH_ROLE` | Rol simulado en el servidor **solo para desarrollo local** (ignorado cuando `NODE_ENV=production`). Dejar sin definir para probar peticiones no autenticadas (`401`). | `ADMIN` u `OPERATOR` (opcional) |

---

## 5. Base de Datos, Migraciones, Ejecución y Pruebas

### 5.1. Crear la base de datos `catalog_db` en PostgreSQL

Si la base de datos `catalog_db` aún no existe en tu instancia local de PostgreSQL 18, créala con `psql` o pgAdmin:

```sql
CREATE DATABASE catalog_db;
```

*(Por convención del sistema, Catalog Service valida que la conexión apunte exclusivamente a `catalog_db` y rechaza conectarse por error a bases de datos de otros microservicios como `wash_order_db`).*

### 5.2. Instalar dependencias y ejecutar migraciones

```powershell
cd catalog
npm install
npm run migrate
```

El comando `npm run migrate` ejecuta `src/infrastructure/database/migrate.js`, aplica `migrations/001_create_catalog_tables.sql` de forma transaccional e idempotente, registra las migraciones aplicadas en la tabla `schema_migrations` y crea:
- Tabla `wash_services` (con restricciones `CHECK`, índice parcial de unicidad case-insensitive `idx_wash_services_unique_active_name` para servicios activos y columna `version` para concurrencia optimista).
- Tabla `outbox_events` (con índice parcial `idx_outbox_events_pending` sobre `published_at IS NULL` e índice por `aggregate_id`).

### 5.3. Iniciar el microservicio

- **Modo estándar (producción / desarrollo sin rol preinyectado):**
  ```powershell
  npm start
  ```
- **Modo desarrollo con recarga automática (`nodemon`):**
  ```powershell
  npm run dev
  ```
- **Modo desarrollo con contexto administrativo local (`DEV_AUTH_ROLE=ADMIN`):**
  Útil para probar directamente los endpoints `/api/catalog/admin/*` mientras `API Gateway` e `Identity Service` aún no están integrados:
  ```powershell
  npm run dev:admin
  ```

### 5.4. Ejecutar pruebas automatizadas

Las pruebas de integración crean esquemas temporales aislados (`catalog_test_*`, `catalog_outbox_test_*`) dentro de `catalog_db` y los eliminan al finalizar (`DROP SCHEMA ... CASCADE`), por lo que **nunca alteran ni borran los datos del esquema `public`**.

```powershell
# Ejecutar todas las suites unitarias y de integración
npm test

# Ejecutar todas las pruebas generando reporte de cobertura
npm run test:coverage
```

---

## 6. Uso de `catalog.http` y `catalog.postman_collection.json`

### 6.1. Visual Studio Code REST Client (`catalog/catalog.http`)
1. Instala la extensión **REST Client** (`humao.rest-client`) en VS Code.
2. Inicia el servicio con `npm run dev:admin` para habilitar el contexto administrativo de desarrollo.
3. Abre `catalog/catalog.http`.
4. Ejecuta las peticiones en orden haciendo clic en **Send Request** sobre cada bloque `###`. La petición `### 2.1 Crear un servicio de prueba` (`# @name createService`) captura automáticamente el `id` generado en la variable `@serviceId = {{createService.response.body.id}}` para reutilizarlo en todas las peticiones siguientes.

### 6.2. Postman (`catalog/catalog.postman_collection.json`)
1. En Postman, selecciona **Import** e importa el archivo `catalog/catalog.postman_collection.json`.
2. La colección incluye las variables `baseUrl` (`http://localhost:3002`), `serviceId`, `missingId` y `serviceName`, además de scripts de validación automática en la pestaña **Tests** de cada request.
3.Al ejecutar **Administración -> 2. POST /api/catalog/admin/services — Crear servicio**, el script guarda automáticamente el `id` devuelto en la variable de colección `{{serviceId}}`.
4. Sigue el flujo de 12 pasos documentado en la descripción de la colección para verificar el ciclo completo (creación, consulta pública, consulta batch con existentes/inexistentes, actualización, cambio de precio, desactivación, ocultamiento público, listado admin con filtro `isActive=false`, reactivación y casos de error `400`, `404`, `409`, `401` y `403`).

---

## 7. Referencia de Endpoints REST y Autenticación

### 7.1. Resumen de Endpoints

| Método | Ruta | Acceso | Éxito | Descripción |
|---|---|---|---|---|
| `GET` | `/health` | Público | `200 OK` | Estado de salud del servicio (`status`, `service`, `timestamp`). |
| `GET` | `/api/catalog/services` | Público | `200 OK` | Lista únicamente los servicios activos (`isActive: true`). |
| `GET` | `/api/catalog/services/:id` | Público | `200 OK` | Obtiene un servicio activo por su UUID (`404` si no existe o está inactivo). |
| `POST` | `/api/catalog/services/batch` | Público / Interno | `200 OK` | Consulta múltiples servicios por lista de UUIDs; devuelve `{ services, notFound }`. |
| `GET` | `/api/catalog/admin/services` | `ADMIN` | `200 OK` | Lista todos los servicios; acepta filtro opcional `?isActive=true\|false`. |
| `POST` | `/api/catalog/admin/services` | `ADMIN` | `201 Created` | Crea un nuevo servicio activo (`version = 1`) y registra `ServiceCreated` en Outbox. |
| `PUT` | `/api/catalog/admin/services/:id` | `ADMIN` | `200 OK` | Actualiza `name`, `description` y/o `estimatedDuration` (incrementa `version`). |
| `PATCH` | `/api/catalog/admin/services/:id/price` | `ADMIN` | `200 OK` | Actualiza el precio del servicio (incrementa `version` y registra `ServicePriceChanged`). |
| `PATCH` | `/api/catalog/admin/services/:id/activate` | `ADMIN` | `200 OK` | Activa un servicio inactivo (idempotente si ya está activo). |
| `PATCH` | `/api/catalog/admin/services/:id/deactivate` | `ADMIN` | `200 OK` | Desactiva un servicio activo (idempotente si ya está inactivo). |

### 7.2. Estructura de Solicitudes y Respuestas

#### DTO de Servicio (`ServiceDto`)
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Lavado Premium Completo",
  "description": "Lavado exterior con espuma activa, aspirado profundo y encerado.",
  "price": 65,
  "currency": "BOB",
  "estimatedDuration": 45,
  "isActive": true,
  "version": 1,
  "createdAt": "2026-11-13T18:00:00.000Z",
  "updatedAt": "2026-11-13T18:00:00.000Z"
}
```

#### Cuerpos de Solicitud (Requests)
- **`POST /api/catalog/admin/services`:**
  ```json
  {
    "name": "Lavado Ejecutivo",
    "description": "Lavado exterior e interior rápido",
    "price": 45.5,
    "estimatedDuration": 30
  }
  ```
- **`PUT /api/catalog/admin/services/:id`:** (al menos uno de los campos requerido; no modifica `price` ni `isActive`)
  ```json
  {
    "name": "Lavado Ejecutivo Plus",
    "description": "Incluye limpieza de tablero",
    "estimatedDuration": 40
  }
  ```
- **`PATCH /api/catalog/admin/services/:id/price`:**
  ```json
  {
    "price": 55.00
  }
  ```
- **`POST /api/catalog/services/batch`:** (`ids` arreglo no vacío de UUIDs; opcional `"onlyActive": true`)
  ```json
  {
    "ids": [
      "550e8400-e29b-41d4-a716-446655440000",
      "99999999-9999-4999-8999-999999999999"
    ],
    "onlyActive": true
  }
  ```
  **Respuesta `200 OK`:**
  ```json
  {
    "services": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Lavado Ejecutivo Plus",
        "description": "Incluye limpieza de tablero",
        "price": 55,
        "currency": "BOB",
        "estimatedDuration": 40,
        "isActive": true,
        "version": 3,
        "createdAt": "2026-11-13T18:00:00.000Z",
        "updatedAt": "2026-11-13T18:05:00.000Z"
      }
    ],
    "notFound": [
      "99999999-9999-4999-8999-999999999999"
    ]
  }
  ```

#### Formato uniforme de errores HTTP
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "El precio del servicio debe ser mayor a 0."
  }
}
```

| Código HTTP | `error.code` | Causa |
|---|---|---|
| `400 Bad Request` | `VALIDATION_ERROR`, `INVALID_SERVICE_NAME`, `INVALID_MONEY`, `INVALID_DURATION`, `EMPTY_SERVICE_UPDATE`, `INVALID_JSON` | Datos de entrada inválidos, UUID mal formado, filtro `isActive` inválido o JSON malformado. |
| `401 Unauthorized` | `UNAUTHORIZED` | Petición a ruta `/api/catalog/admin/*` sin contexto de autenticación verificado (`req.auth`). |
| `403 Forbidden` | `FORBIDDEN` | Contexto autenticado pero sin el rol requerido (`ADMIN`). |
| `404 Not Found` | `SERVICE_NOT_FOUND`, `ROUTE_NOT_FOUND` | El servicio solicitado no existe (o está inactivo en rutas públicas) o la ruta HTTP no existe. |
| `409 Conflict` | `DUPLICATE_SERVICE_NAME`, `CONCURRENCY_CONFLICT` | Ya existe un servicio activo con el mismo nombre (case-insensitive) o ocurrió una colisión de concurrencia optimista (`version`). |
| `500 Internal Server Error` | `INTERNAL_SERVER_ERROR` | Error interno inesperado (no expone trazas ni detalles sensibles de infraestructura). |

### 7.3. Comportamiento actual de Autenticación y Autorización

- Las rutas administrativas `/api/catalog/admin/*` están protegidas por el middleware `requireRole('ADMIN')` (`src/presentation/middlewares/requireRole.js`).
- Por diseño de seguridad, `requireRole` **jamás lee ni confía en encabezados HTTP enviados directamente por el cliente** (como `X-User-Role`), evitando ataques de suplantación de privilegios (*privilege spoofing*).
- El middleware evalúa únicamente el objeto `req.auth` inyectado en el servidor:
  - En pruebas automatizadas o cuando se conecte el middleware del API Gateway / Identity Service, `req.auth` se inyecta tras validar la firma del token.
  - En desarrollo local (`NODE_ENV !== 'production'`), si se define `DEV_AUTH_ROLE=ADMIN` (por ejemplo con `npm run dev:admin`), `src/app.js` inyecta `req.auth = { role: 'ADMIN', source: 'dev-env' }`.

---

## 8. Eventos Kafka, Transactional Outbox y Garantía de Entrega

### 8.1. Tópicos y Eventos Publicados

| Evento (`evento`) | Topic de Kafka | Versión (`eventVersion`) | Disparador |
|---|---|---|---|
| `ServiceCreated` | `catalog.service.created` | `1` | Creación de un servicio nuevo (`CreateService`). |
| `ServiceUpdated` | `catalog.service.updated` | `1` | Modificación real de nombre, descripción o duración (`UpdateService`). |
| `ServicePriceChanged` | `catalog.service.price-changed` | `1` | Cambio real del precio del servicio (`ChangeServicePrice`). |
| `ServiceActivated` | `catalog.service.activated` | `1` | Paso de estado inactivo a activo (`ActivateService`). |
| `ServiceDeactivated` | `catalog.service.deactivated` | `1` | Paso de estado activo a inactivo (`DeactivateService`). |

*(Si una operación es idempotente y no produce cambios efectivos de estado, el agregado no incrementa `version` ni emite eventos innecesarios).*

### 8.2. Estructura del Sobre de Eventos (Event Envelope)

Todos los mensajes publicados en Kafka utilizan `aggregateId` (UUID del servicio) como **clave de partición (`key`)** para garantizar el orden de eventos de un mismo servicio dentro de la partición, y contienen el siguiente sobre JSON en `value`:

```json
{
  "eventId": "f1d2c3b4-a5e6-4789-8abc-def012345678",
  "evento": "ServicePriceChanged",
  "eventVersion": 1,
  "fechaEmision": "2026-11-13T18:10:00.000Z",
  "origen": "catalog-service",
  "aggregateId": "550e8400-e29b-41d4-a716-446655440000",
  "datos": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Lavado Ejecutivo Plus",
    "previousPrice": 45.5,
    "newPrice": 55,
    "currency": "BOB",
    "version": 3
  }
}
```

### 8.3. Funcionamiento del Transactional Outbox y Entrega *At-Least-Once*

1. **Escritura atómica:** Cada Command ejecuta `PgUnitOfWork.runInTransaction()`, guardando el cambio en `wash_services` (verificando `WHERE id = $1 AND version = $8` para concurrencia optimista) e insertando los eventos de dominio pendientes en `outbox_events` dentro de la **misma transacción SQL**.
2. **Despacho asíncrono seguro:** `OutboxWorker` reclama periódicamente lotes de eventos con `published_at IS NULL` utilizando `FOR UPDATE SKIP LOCKED`, evitando que dos instancias del worker procesen el mismo evento simultáneamente, y garantiza que nunca se adelante un evento posterior de un mismo `aggregate_id` si existe uno anterior pendiente para ese mismo servicio.
3. **Tolerancia a fallos y auditoría:** Si el broker Kafka falla, el evento no se pierde: se incrementa `attempts`, se guarda el diagnóstico sanitizado en `last_error` (redactando credenciales si existieran en la cadena de error) y se reintenta en el siguiente ciclo. Cuando se publica con éxito, se marca `published_at = NOW()` conservando el registro histórico en `outbox_events`.
4. **Garantía *At-Least-Once* e idempotencia:** El patrón Transactional Outbox garantiza entrega **al menos una vez (*at-least-once*)**. Si Kafka recibe el mensaje pero el proceso cae antes de confirmar el `UPDATE` de `published_at`, el evento se volverá a enviar al reiniciar. Por ello, **todos los consumidores de Kafka deben implementar idempotencia registrando `eventId`**.

---

## 9. Integraciones Pendientes con el Equipo

Catalog Service está completamente implementado, probado y listo para integrarse. Las siguientes conexiones dependen de los componentes desarrollados por los demás integrantes del equipo:

### 9.1. Integración con Wash Order Service
- **Opción A — Consulta HTTP síncrona por lote (lista para usar):** Wash Order Service puede invocar `POST http://localhost:3002/api/catalog/services/batch` enviando `{ "ids": [...], "onlyActive": true }`. Catalog Service devolverá en una sola llamada los servicios válidos con su `name`, `price`, `currency` (`BOB`) y `estimatedDuration` oficiales, además del arreglo `notFound` con cualquier UUID inexistente o inactivo para que Wash Order rechace la orden si corresponde.
- **Opción B — Réplica local por eventos Kafka (lista para usar):** Wash Order Service puede suscribirse a los 5 tópicos `catalog.service.*` para mantener una tabla espejo local (*read model* / snapshot de servicios) actualizada en tiempo real.

### 9.2. Integración con API Gateway e Identity Service
- Cuando **Identity Service** y **API Gateway** estén operativos, el Gateway validará el JWT del usuario o bien `Catalog Service` incorporará el middleware de verificación JWT antes de `createCatalogRouter`.
- El middleware de autenticación únicamente debe poblar `req.auth = { userId, role }` (donde `role` sea `'ADMIN'` para administradores); `requireRole('ADMIN')` ya está conectado en todas las rutas `/api/catalog/admin/*` y funcionará sin modificar controladores ni casos de uso.

### 9.3. Integración con Consumidores de Apache Kafka
- Cualquier microservicio consumidor (**Wash Order**, **Notification**, **Reporting**, etc.) debe conectarse al mismo clúster Kafka (`KAFKA_BROKERS`), suscribirse a `catalog.service.created`, `catalog.service.updated`, `catalog.service.price-changed`, `catalog.service.activated` y/o `catalog.service.deactivated`, leer el sobre JSON estandarizado y descartar eventos duplicados verificando `eventId`.
