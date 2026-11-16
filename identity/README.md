# Identity Service

Microservicio de **registro, autenticación y roles de acceso** de la Plataforma de Gestión para Car Wash (Ingeniería Web III).

## 1. Responsabilidad

- Registrar usuarios del personal: administradores, recepcionistas y personal de lavado.
- Autenticar con correo y contraseña y emitir tokens JWT.
- Validar tokens para el API Gateway y los demás microservicios.
- Administrar roles, permisos y el estado de las cuentas (activar y desactivar).

**Fuera de su alcance:** los clientes del lavadero y sus vehículos pertenecen a Customer / Vehicle Service. Los clientes no inician sesión en la plataforma.

## 2. Arquitectura

Clean Architecture + DDD + CQRS, con la misma organización que Catalog Service.

| Capa | Carpeta | Contenido |
|---|---|---|
| Domain | `src/domain/` | Agregado `User`, value objects (`Email`, `FullName`, `Role`, `PlainPassword`), eventos y errores de dominio. Sin dependencias externas. |
| Application | `src/application/` | `commands/` (escritura), `queries/` (lectura), puertos (`UserRepository`, `PasswordHasher`, `TokenService`, `EventPublisher`), DTO y errores. |
| Infrastructure | `src/infrastructure/` | Repositorio en memoria, bcrypt, JWT y publicador de eventos por consola. |
| Presentation | `src/presentation/` | Rutas Express 5, controladores, validadores HTTP y middlewares. |

- `src/container.js` es el composition root: el único lugar donde se eligen las implementaciones de los puertos.
- `tests/unit/architecture.test.js` falla si una capa importa algo que no le corresponde.

### Patrones aplicados

- **Repository y Ports & Adapters:** los casos de uso dependen de interfaces. Cambiar memoria por PostgreSQL no toca la lógica.
- **Value Object:** las reglas de correo, nombre, rol y contraseña viven en un solo lugar.
- **Aggregate Root con eventos de dominio:** `User` registra los eventos y la aplicación los publica después de guardar.
- **Composition Root / Inyección de dependencias:** facilita las pruebas sin mocks de módulos.

### Decisiones de seguridad

- Las contraseñas se guardan con bcrypt. Nunca se registran ni se devuelven.
- No hay registro público. Solo un administrador crea cuentas, y el primer administrador se crea al arrancar desde el `.env`.
- El login responde el mismo error si el correo no existe o si la contraseña es incorrecta.
- El login tiene un límite de intentos por IP.
- **Revocación de tokens:** cada usuario tiene un `tokenVersion` que sube al cambiar contraseña o rol, o al desactivar la cuenta. Los tokens anteriores dejan de ser válidos.
- No se puede desactivar ni quitar el rol al último administrador activo. Un administrador tampoco puede desactivarse ni cambiarse el rol a sí mismo.
- El servicio no arranca si `JWT_SECRET` falta o tiene menos de 32 caracteres.

## 3. Ejecución

Requiere Node.js 20 o superior.

```powershell
cd identity
npm install
Copy-Item .env.example .env   # luego reemplazar JWT_SECRET por un valor aleatorio
npm run dev                   # o: npm start
```

Para generar un secreto:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Al arrancar se crea el administrador inicial definido en `ADMIN_EMAIL` y `ADMIN_PASSWORD`, solo si no existe ningún usuario.

> **Persistencia temporal en memoria:** los usuarios se pierden al reiniciar el servicio. Se reemplazará por PostgreSQL.

### Pruebas

```powershell
npm test
npm run test:coverage
npx jest tests/unit/domain/User.test.js   # un solo archivo
npx jest -t "revoca"                      # por nombre de prueba
```

### Postman

Importar `identity.postman_collection.json` y ejecutarla completa con el Collection Runner, en orden. Los tokens y los ids se guardan solos en las variables de la colección.

## 4. Variables de entorno

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `PORT` | Puerto HTTP | `3001` |
| `TRUST_PROXY` | Proxies de confianza delante del servicio. Usar `1` detrás del API Gateway para que el límite de login vea la IP real. | `0` |
| `JWT_SECRET` | Secreto de firma HS256. **Obligatorio**, mínimo 32 caracteres. | — |
| `JWT_EXPIRES_IN` | Duración del token | `1h` |
| `JWT_ISSUER` / `JWT_AUDIENCE` | Emisor y audiencia validados en cada token | `carwash-identity` / `carwash-platform` |
| `BCRYPT_ROUNDS` | Costo de bcrypt (máximo 15) | `10` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_FULL_NAME` | Administrador inicial | — |
| `LOGIN_RATE_LIMIT_MAX` / `LOGIN_RATE_LIMIT_WINDOW_MS` | Intentos de login por IP y ventana | `10` / `60000` |

## 5. Endpoints

| Método | Ruta | Acceso | Éxito | Descripción |
|---|---|---|---|---|
| `GET` | `/health` | Público | 200 | Estado del servicio |
| `POST` | `/api/identity/auth/login` | Público | 200 | Login. Devuelve `accessToken`, `tokenType`, `expiresIn`, `expiresAt` y `user` |
| `POST` | `/api/identity/auth/verify` | Público | 200 | Valida un token (en `{ "token": "..." }` o en `Authorization`). Para el API Gateway |
| `GET` | `/api/identity/auth/me` | Autenticado | 200 | Perfil propio |
| `PATCH` | `/api/identity/auth/me/password` | Autenticado | 200 | Cambiar la contraseña propia. Revoca los tokens anteriores |
| `GET` | `/api/identity/roles` | Autenticado | 200 | Roles con descripción y permisos |
| `GET` | `/api/identity/users` | ADMIN | 200 | Lista paginada. Filtros: `role`, `isActive`, `search`, `page`, `pageSize` |
| `POST` | `/api/identity/users` | ADMIN | 201 | Crear usuario |
| `GET` | `/api/identity/users/:id` | ADMIN | 200 | Detalle |
| `PATCH` | `/api/identity/users/:id` | ADMIN | 200 | Actualizar `fullName` |
| `PATCH` | `/api/identity/users/:id/role` | ADMIN | 200 | Cambiar rol |
| `PATCH` | `/api/identity/users/:id/password` | ADMIN | 200 | Restablecer contraseña |
| `PATCH` | `/api/identity/users/:id/activate` | ADMIN | 200 | Activar (idempotente) |
| `PATCH` | `/api/identity/users/:id/deactivate` | ADMIN | 200 | Desactivar (idempotente) |

Ejemplo de creación:

```json
POST /api/identity/users
{ "email": "carlos@carwash.local", "fullName": "Carlos Mamani", "password": "Lavador123", "role": "WASHER" }
```

Los errores siguen el mismo formato que Catalog Service:

```json
{ "error": { "code": "EMAIL_ALREADY_REGISTERED", "message": "...", "details": [] } }
```

| Código HTTP | Casos |
|---|---|
| 400 | `VALIDATION_ERROR`, `INVALID_JSON`, `INVALID_EMAIL`, `WEAK_PASSWORD`, `INVALID_ROLE`, `INCORRECT_CURRENT_PASSWORD` |
| 401 | `INVALID_CREDENTIALS`, `INVALID_TOKEN` |
| 403 | `FORBIDDEN`, `ACCOUNT_DISABLED`, `FORBIDDEN_OPERATION` |
| 404 | `USER_NOT_FOUND`, `NOT_FOUND` |
| 409 | `EMAIL_ALREADY_REGISTERED`, `LAST_ADMIN`, `CONCURRENCY_CONFLICT` |
| 413 | `PAYLOAD_TOO_LARGE` |
| 429 | `TOO_MANY_REQUESTS` |

## 6. Roles y permisos

| Rol | Uso | Permisos |
|---|---|---|
| `ADMIN` | Administrador | `users:manage`, `catalog:manage`, `customers:manage`, `orders:create`, `orders:assign`, `orders:change-status`, `payments:register`, `reports:read` |
| `RECEPTIONIST` | Recepción y caja | `customers:manage`, `orders:create`, `orders:assign`, `orders:change-status`, `payments:register` |
| `WASHER` | Personal de lavado | `orders:read-assigned`, `orders:change-status` |

## 7. Integración con otros servicios

**JWT.** Contiene `sub` (id del usuario), `role`, `tv` (versión de token), `iss`, `aud`, `iat`, `exp` y `jti`. No contiene datos personales.

**API Gateway.** Tiene dos opciones:
- Verificar el JWT localmente con el mismo `JWT_SECRET`, `JWT_ISSUER` y `JWT_AUDIENCE`. Es más rápido, pero no detecta tokens revocados hasta que expiran.
- Llamar a `POST /api/identity/auth/verify`. Detecta tokens revocados y cuentas desactivadas al instante.

Con cualquiera de las dos, el Gateway reenvía el contexto y cada servicio llena `req.auth = { userId, role }`. Es el contrato que ya usa `requireRole` en Catalog Service.

**Wash Order Service.** Para asignar responsables puede consultar `GET /api/identity/users?role=WASHER&isActive=true`.

## 8. Eventos de dominio

Hoy se escriben en consola con su topic y su sobre definitivos. El sobre es el mismo de Catalog Service: `eventId`, `evento`, `eventVersion`, `fechaEmision`, `aggregateId`, `origen`, `datos`. Nunca incluyen contraseñas ni hashes.

| Evento | Topic |
|---|---|
| `UserRegistered` | `identity.user.registered` |
| `UserRoleChanged` | `identity.user.role-changed` |
| `UserProfileUpdated` | `identity.user.profile-updated` |
| `UserPasswordChanged` | `identity.user.password-changed` |
| `UserActivated` | `identity.user.activated` |
| `UserDeactivated` | `identity.user.deactivated` |

## 9. Pendiente

1. **PostgreSQL:** implementar `PgUserRepository` con el puerto `UserRepository`, migraciones y una base `identity_db` propia. Cambiar solo `src/container.js`.
2. **Eventos reales:** publicar en Kafka con Transactional Outbox, como Catalog Service.
3. **Docker:** `Dockerfile` y servicio en `docker-compose` junto a PostgreSQL.
4. **Refresh tokens:** hoy el usuario vuelve a iniciar sesión cuando el token expira.
