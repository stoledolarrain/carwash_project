# Payment Service

Microservicio de registro de pagos de la Plataforma de Gestión para Car Wash. Registra monto, método (EFECTIVO, QR o TARJETA) y fecha, sin cobro real. Está hecho en Java 21 con Spring Boot.

## Ejecución local

Requiere Java 21 o superior y PostgreSQL. Maven no hace falta: el proyecto trae su propio wrapper (`mvnw`).

1. Crear la base de datos vacía en pgAdmin:
   ```sql
   CREATE DATABASE carwash_payments;
   ```
2. Crear el archivo `.env` y poner la contraseña de PostgreSQL:
   ```powershell
   cd payment
   Copy-Item .env.example .env
   ```
3. Arrancar el servicio desde la carpeta `payment`:
   ```powershell
   .\mvnw.cmd spring-boot:run
   ```

La tabla `payments` se crea sola al arrancar.

## Configuración

Spring Boot no lee archivos `.env` por su cuenta. Este servicio lo hace mediante la línea `spring.config.import` de `src/main/resources/application.properties`, y busca el `.env` en la carpeta desde donde se ejecuta. Por eso hay que arrancarlo desde `payment/`.

Si el `.env` no existe, se usan los valores por defecto de `application.properties`. Las variables de entorno del sistema, como las de `docker-compose.yml`, tienen prioridad sobre el `.env`.

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `PORT` | Puerto HTTP | `3003` |
| `DB_HOST` / `DB_PORT` | Servidor PostgreSQL | `localhost` / `5432` |
| `DB_USER` / `DB_PASSWORD` | Credenciales de PostgreSQL | `postgres` / `postgres` |
| `DB_NAME` | Base de datos propia del servicio | `carwash_payments` |
| `NOTIFICATION_URL` | URL de Notification Service | `http://localhost:3004` |
| `JWT_SECRET` | **Obligatorio.** El mismo secreto de Identity Service. Sin él el servicio no arranca | — |
| `JWT_ISSUER` / `JWT_AUDIENCE` | Los mismos valores de Identity Service | `carwash-identity` / `carwash-platform` |

## Seguridad

`src/main/java/.../infrastructure/security/SecurityConfig.java` usa Spring Security para verificar el JWT de Identity Service: firma HS256, expiración, emisor, audiencia y rol. El rol sale del claim `role` del token, nunca de encabezados del cliente.

| Ruta | Acceso |
|---|---|
| `GET /api/payments/health` | Público |
| `POST /api/payments` y `GET /api/payments` | ADMIN y RECEPTIONIST |

Sin token, o con uno inválido o vencido, responde 401. Con otro rol responde 403. El formato es `{ "error": { "code", "message" } }`.

Al registrar un pago, el aviso a Notification Service lleva el mismo token del usuario que registró el pago, porque Notification también exige JWT.

Las pruebas de seguridad no necesitan base de datos:

```powershell
.\mvnw.cmd test -Dtest=PaymentSecurityTest
```

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/payments` | Registrar un pago: `{ "orderId", "customerName", "amount", "method" }` |
| `GET` | `/api/payments` | Listar pagos. Filtro opcional `?orderId=` |
| `GET` | `/api/payments/health` | Estado del servicio |

## Docker

`docker-compose.yml` levanta el servicio junto a su propia base PostgreSQL en el puerto 5436 del equipo:

```powershell
docker compose up --build
```
