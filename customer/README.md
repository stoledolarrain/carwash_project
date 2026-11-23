# Customer / Vehicle Service

Microservicio responsable de administrar los **clientes**, sus **vehículos identificados por placa** y la consulta del **historial básico de atención** dentro de la **Plataforma de Gestión para Car Wash** (Ingeniería Web III).

---

## Responsabilidad

- Administrar el registro, consulta, actualización y activación/desactivación de clientes (`Customer`).
- Administrar el registro, consulta por ID/placa, actualización y asociación/desasociación de vehículos (`Vehicle`) con placa única e inmutable.
- Mantener una proyección local del historial de atención (`wash_history`) alimentada por eventos Kafka publicados por **Wash Order Service** (`wash-order.order.events`) con deduplicación idempotente en `inbox_events`.
- Registrar sus propios eventos de dominio en `outbox_events` (Transactional Outbox) para publicación asíncrona hacia Apache Kafka.
- Operar de forma independiente con su propia base de datos PostgreSQL (`customer_db`), sin compartir tablas ni modificar otros microservicios.

---

## Tecnologías utilizadas

- **Lenguaje:** Python 3.13 (`3.13.16`)
- **Framework web y API:** Django 5.2 LTS (`5.2.19`) y Django REST Framework (`3.18.3`)
- **Base de datos:** PostgreSQL 18 mediante `psycopg[binary]` 3 (`3.3.9`)
- **Autenticación JWT:** `PyJWT` (`2.15.1`, algoritmo `HS256` compatible con Identity Service)
- **Variables de entorno:** `python-dotenv` (`1.2.4`)
- **Mensajería Kafka:** `confluent-kafka` (`2.16.1`)
- **Pruebas:** `pytest` (`9.2.0`) y `pytest-django` (`4.14.0`)

---

## Configuración asignada

- **Puerto HTTP:** `3005`
- **Prefijo de API:** `/api/customer` (salud pública en `GET /health`)
- **Base de datos PostgreSQL exclusiva:** `customer_db` (la configuración rechaza conectarse a bases de datos de otros servicios como `catalog_db` o `identity_db`)

---

## Preparación del entorno (Windows PowerShell)

### 1. Crear y activar el entorno virtual independiente

```powershell
cd customer
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 2. Instalar dependencias

```powershell
# Desarrollo y pruebas (incluye producción)
python -m pip install -r requirements-dev.txt
```

### 3. Crear la base de datos `customer_db` y configurar `.env`

Crea la base de datos exclusiva en **pgAdmin** (*Databases -> Create -> Database* -> `customer_db`) o en `psql`:

```sql
CREATE DATABASE customer_db;
```

Luego copia `.env.example` a `.env` (ignorado por Git):

```powershell
Copy-Item .env.example .env
```

Completa en `customer/.env`:
- `DJANGO_SECRET_KEY`: clave propia de Django (**distinta** de `JWT_SECRET`).
- `DATABASE_URL`: cadena de conexión apuntando exclusivamente a `customer_db`.
- `JWT_SECRET` (mínimo 32 caracteres), `JWT_ISSUER` (`carwash-identity`) y `JWT_AUDIENCE` (`carwash-platform`): deben ser **exactamente iguales** a los de Identity Service y API Gateway.

### 4. Aplicar migraciones

```powershell
python manage.py migrate
```

---

## Ejecución y pruebas

### Iniciar el servidor HTTP (puerto 3005)

```powershell
python manage.py runserver 3005
```

### Procesos de Apache Kafka (requieren broker en `KAFKA_BROKERS`)

```powershell
# Consumidor de eventos de Wash Order (topic: wash-order.order.events -> inbox_events + wash_history)
python manage.py consume_order_events

# Publicador de eventos propios de Customer (outbox_events -> Kafka)
python manage.py publish_outbox
python manage.py publish_outbox --once   # procesa un único lote y finaliza
```

> **Nota sobre Outbox:** Customer persiste sus eventos propios (`CustomerRegistered`, `CustomerUpdated`, `CustomerActivated`, `CustomerDeactivated`, `VehicleRegistered`, `VehicleUpdated`) en `outbox_events` para publicarlos en `customer.customer.*` y `customer.vehicle.*`. Actualmente ningún otro microservicio consume todavía estos topics; su aprovechamiento (p. ej. réplicas locales en Wash Order o Notification) queda abierto a coordinación con el equipo.

### Ejecutar pruebas automatizadas y verificaciones

```powershell
python manage.py check
python manage.py makemigrations --check --dry-run
pytest
```

---

## Pruebas manuales (REST Client y Postman)

Todos los endpoints bajo `/api/customer/*` requieren `Authorization: Bearer <token>` con rol `ADMIN` o `RECEPTIONIST` (`WASHER` recibe `403 FORBIDDEN`, sin token recibe `401 UNAUTHORIZED`). `GET /health` es público.

### VS Code REST Client (`customer/customer.http`)
1. Instala la extensión **REST Client** en VS Code e inicia `python manage.py runserver 3005`.
2. Abre [`customer/customer.http`](customer.http) y pega tu JWT de Identity en `@token`.
3. Ejecuta las peticiones en orden (`1.1` Health -> `2.1` Crear cliente -> `3.1` Crear vehículo -> resto de operaciones). `@customerId` y `@vehicleId` se capturan automáticamente desde las respuestas de creación.

### Postman (`customer/customer.postman_collection.json`)
1. En Postman haz clic en **Import** y selecciona [`customer/customer.postman_collection.json`](customer.postman_collection.json).
2. En la pestaña **Variables** de la colección, pega tu JWT de Identity en la variable `token` (deja `baseUrl = http://localhost:3005`).
3. Ejecuta las carpetas en orden: `Health` -> `Clientes` -> `Vehículos` -> `Historial` -> `Casos de error`. Las pruebas automáticas incluidas verifican los códigos HTTP y guardan `customerId`, `vehicleId` y `plate`.

---

## Estructura de capas (Clean Architecture)

```text
customer/
├── manage.py
├── pytest.ini
├── requirements.txt
├── requirements-dev.txt
├── customer.http
├── customer.postman_collection.json
├── .env.example
├── .gitignore
├── config/             # settings.py, env.py, urls.py, container.py
├── domain/             # Customer, Vehicle, Plate, PhoneNumber, Email, events, errors
├── application/        # Commands, Queries, DTOs, Ports, errors
├── infrastructure/     # Modelos ORM, migraciones, repositorios, Outbox, Inbox, Kafka, JWT
├── presentation/       # Vistas DRF, serializers, autenticación, permisos, management commands
└── tests/              # Pruebas unitarias (unit/) y de integración (integration/)
```

---

## Endpoints REST y tablas de `customer_db`

### Endpoints disponibles

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/health` | Público | Salud del servicio (`200 OK`) |
| `POST` | `/api/customer/customers` | `ADMIN`, `RECEPTIONIST` | Registrar cliente (`201`) |
| `GET` | `/api/customer/customers` | `ADMIN`, `RECEPTIONIST` | Listar/buscar (`query`, `is_active`, `page`, `page_size`) |
| `GET` | `/api/customer/customers/{id}` | `ADMIN`, `RECEPTIONIST` | Obtener cliente por UUID |
| `PATCH` | `/api/customer/customers/{id}` | `ADMIN`, `RECEPTIONIST` | Actualizar `name`, `phone`, `email` |
| `PATCH` | `/api/customer/customers/{id}/activate` | `ADMIN`, `RECEPTIONIST` | Activar cliente (`409` si ya está activo) |
| `PATCH` | `/api/customer/customers/{id}/deactivate` | `ADMIN`, `RECEPTIONIST` | Desactivar cliente (`409` si ya está inactivo) |
| `GET` | `/api/customer/customers/{id}/vehicles` | `ADMIN`, `RECEPTIONIST` | Listar vehículos del cliente (paginado) |
| `GET` | `/api/customer/customers/{id}/history` | `ADMIN`, `RECEPTIONIST` | Historial de lavados del cliente (paginado, filtro `status`) |
| `POST` | `/api/customer/vehicles` | `ADMIN`, `RECEPTIONIST` | Registrar vehículo (`customerId` opcional, placa única) |
| `GET` | `/api/customer/vehicles/{id}` | `ADMIN`, `RECEPTIONIST` | Obtener vehículo por UUID |
| `GET` | `/api/customer/vehicles/by-plate/{plate}` | `ADMIN`, `RECEPTIONIST` | Buscar vehículo por placa normalizada |
| `PATCH` | `/api/customer/vehicles/{id}` | `ADMIN`, `RECEPTIONIST` | Actualizar `brand`, `model`, `color` (placa inmutable) |
| `PATCH` | `/api/customer/vehicles/{id}/customer` | `ADMIN`, `RECEPTIONIST` | Asociar, reasignar o desasociar (`customerId: null`) |
| `GET` | `/api/customer/vehicles/{id}/history` | `ADMIN`, `RECEPTIONIST` | Historial de lavados del vehículo (paginado, filtro `status`) |

### Tablas propias en `customer_db`
- `customers`: clientes (`id` UUID PK, `name`, `phone`, `email`, `is_active`, fechas).
- `vehicles`: vehículos (`id` UUID PK, `plate` UNIQUE 5..10, `brand`, `model`, `color`, `customer_id` FK `RESTRICT` nullable, fechas).
- `wash_history`: proyección local de órdenes (`order_id` UUID PK sin FK, `plate`, `customer_id` UUID nullable sin FK, `services` JSONB, `total_price`, `responsible_id`, `status`, `created_at`, `delivered_at`, `last_event_at`).
- `inbox_events`: deduplicación idempotente por `event_id` (UUID PK).
- `outbox_events`: eventos propios de Customer pendientes/publicados hacia Kafka.

---

## Integración con los demás microservicios

### 1. Identity Service (`:3001`)
- Customer valida localmente JWT **HS256** emitidos por Identity usando `JWT_SECRET`, `JWT_ISSUER=carwash-identity` y `JWT_AUDIENCE=carwash-platform`.
- Roles respetados del contrato de Identity (`Role.js`): `ADMIN` y `RECEPTIONIST` (`customers:manage`) tienen acceso; `WASHER` recibe `403 FORBIDDEN`.

### 2. Wash Order Service (`:3004`)
- **Consumo Kafka:** Wash Order publica los 4 eventos (`WashOrderCreated`, `WashStarted`, `WashCompleted`, `WashDelivered`) en el topic `wash-order.order.events` con clave `aggregateId`, `"origen": "wash-order-service"` y payload completo (`toEventPayload()`).
- **Campos que deben coincidir:** `clienteId` debe ser el UUID de Customer (o `null`), y `placaVehiculo` sigue la misma normalización (`strip().upper()`, 5..10 caracteres, guion conservado).
- **Consulta HTTP disponible para Wash Order:** `GET /api/customer/vehicles/by-plate/{plate}` y `GET /api/customer/customers/{id}` (reenviando el encabezado `Authorization: Bearer <JWT>`).

### 3. Catalog Service (`:3002`)
- Sin dependencia directa: Customer almacena los códigos de `servicios` tal como los publica Wash Order.

### 4. Guía de integración para API Gateway (`:8080`)
El responsable de `api-gateway/` solo necesita registrar una entrada en `api-gateway/src/config/services.js` y la variable en `api-gateway/src/config/env.js`:

- **Prefijo público:** `/api/customer` (conservar el prefijo completo al reenviar).
- **Destino interno:** `http://localhost:3005` (variable sugerida: `CUSTOMER_SERVICE_URL`).
- **Encabezados:** reenviar `Authorization: Bearer <JWT>` sin modificarlo (el Gateway ya lo hace por defecto).
- **Rutas públicas:** ninguna (`publicRoutes: []`); **rutas bloqueadas:** ninguna (`blockedRoutes: []`).
- **Health check interno:** `GET http://localhost:3005/health` (coincide con `/health/services` del Gateway).

**Cómo verificar una vez configurado el Gateway:**
1. `GET http://localhost:8080/health/services` -> debe reportar `customer: up`.
2. Iniciar sesión en `POST http://localhost:8080/api/identity/auth/login` con un usuario `ADMIN` o `RECEPTIONIST`.
3. Consultar `GET http://localhost:8080/api/customer/customers` enviando `Authorization: Bearer <token>` -> debe responder `200 OK`.

### 5. Pasos para verificar Kafka de extremo a extremo (cuando el broker esté activo)
1. Levantar Apache Kafka en `localhost:9092` (p. ej. contenedor KRaft en puerto `9092`).
2. Asegurar `KAFKA_BROKERS=localhost:9092` en `wash_order/.env` y `customer/.env`.
3. En una terminal iniciar `python manage.py consume_order_events` en `customer/` y en otra iniciar `wash_order/`.
4. Crear un cliente y un vehículo en Customer (`:3005`), luego crear y avanzar una orden en Wash Order (`POST /api/orders`, `/start`, `/complete`, `/deliver`) usando el `clienteId` UUID y la misma placa.
5. Verificar en `GET /api/customer/customers/{id}/history` y `GET /api/customer/vehicles/{id}/history` que la orden aparece con estado `ENTREGADO` en una sola fila de `wash_history` y que sus `eventId` quedaron registrados en `inbox_events` (reentregar un evento con el mismo `eventId` no genera duplicados).
