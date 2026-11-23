# API Gateway

Punto de entrada único de la Plataforma de Gestión para Car Wash (Ingeniería Web III). El frontend y Postman solo hablan con el Gateway, y el Gateway reenvía cada petición al microservicio que corresponde.

## 1. Responsabilidad

- **Enrutamiento:** decide a qué microservicio va cada ruta según su prefijo.
- **Autenticación en el borde:** exige un JWT válido en toda ruta que no sea pública.
- **CORS:** solo acepta peticiones del navegador desde los orígenes del frontend configurados.
- **Límite de solicitudes por IP.**
- **Correlación:** asigna un `X-Request-Id` a cada petición y lo reenvía al servicio.
- **Resiliencia:** responde 503 si un servicio está caído y 504 si no contesta a tiempo.

**Lo que no hace:** no tiene lógica de negocio, no lee ni modifica los cuerpos de las peticiones, y no accede a ninguna base de datos. Cada microservicio vuelve a validar el token y aplica su propia autorización por rol. El Gateway es la primera barrera, no la única.

## 2. Rutas

| Prefijo | Servicio | Puerto local | Variable de entorno | ¿Verifica el JWT por su cuenta? |
|---|---|---|---|---|
| `/api/identity/*` | Identity | 3001 | `IDENTITY_SERVICE_URL` | Sí, y detecta tokens revocados |
| `/api/catalog/*` | Catalog | 3002 | `CATALOG_SERVICE_URL` | Sí, con `JWT_SECRET` en su `.env` |
| `/api/customer/*` | Customer / Vehicle | 3005 | `CUSTOMER_SERVICE_URL` | Sí |
| `/api/orders/*` | Wash Order | 3000 | `WASH_ORDER_SERVICE_URL` | Sí |
| `/api/payments/*` | Payment | 3003 | `PAYMENT_SERVICE_URL` | Sí (Spring Security) |
| `/api/notifications/*` | Notification | 3004 | `NOTIFICATION_SERVICE_URL` | Sí |

Todos los servicios vuelven a verificar el token y revisan el rol por su cuenta, aunque la petición llegue por el Gateway. Así nadie puede saltarse los permisos llamando directo al puerto de un servicio.

Rutas propias del Gateway:

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Estado del Gateway |
| `GET` | `/health/services` | Consulta el health de cada microservicio. Responde 200 si todos están arriba y 503 si alguno falla, indicando cuál. Payment tiene su health en `/api/payments/health`; los demás en `/health` |

Política de acceso para las rutas de los servicios:

| Caso | Resultado |
|---|---|
| Ningún servicio atiende la ruta | 404 `NOT_FOUND` |
| Ruta interna bloqueada: `POST /api/identity/auth/verify`, `POST /api/catalog/services/batch` y `POST /api/notifications`. Otros servicios las llaman directamente | 404 `NOT_FOUND` |
| Ruta pública: `POST /api/identity/auth/login`, `GET /api/catalog/services` y `GET /api/catalog/services/:id` | Pasa sin token |
| Cualquier otra ruta | Exige `Authorization: Bearer <JWT>`. Sin token o con uno inválido o vencido responde 401 `INVALID_TOKEN` |

Por defecto todo exige token. Es más seguro olvidarse de abrir una ruta que olvidarse de cerrarla.

### Agregar otro microservicio

1. Agregar su URL en `src/config/env.js`, dentro de `services`.
2. Agregar una entrada en `src/config/services.js` con su prefijo, su URL, sus rutas públicas y bloqueadas y, si no es `/health`, su `healthPath`. Las rutas aceptan parámetros como `:id`.
3. Agregar la variable en `.env` y `.env.example`.

El servicio debe verificar el JWT por su cuenta con el mismo `JWT_SECRET`, `JWT_ISSUER` y `JWT_AUDIENCE`, y llenar `req.auth = { userId, role }`.

## 3. Cómo funciona el proxy

`src/proxy/serviceProxy.js` usa el módulo `http` de Node directamente, sin librerías externas:

- Conserva la ruta completa y la query: `/api/identity/users?role=WASHER` llega igual al servicio.
- Reenvía el cuerpo como llega, sin leerlo, y reenvía el encabezado `Authorization`.
- Agrega `X-Request-Id`, `X-Forwarded-For`, `X-Forwarded-Proto` y `X-Forwarded-Host`.
- Reemplaza cualquier `X-Forwarded-For` que mande el cliente por la IP real de la conexión, así nadie puede falsificar su IP.
- Devuelve el estado, los encabezados y el cuerpo del servicio sin cambios. Solo `X-Request-Id` y CORS los define el Gateway.

Identity debe tener `TRUST_PROXY=1` para que su límite de intentos de login use la IP real del cliente y no la del Gateway.

## 4. Ejecución

Requiere Node.js 20 o superior y que Identity Service esté corriendo.

```powershell
cd api-gateway
npm install
Copy-Item .env.example .env   # copiar el mismo JWT_SECRET de identity/.env
npm run dev                   # o: npm start
```

Al arrancar muestra las rutas y los orígenes CORS configurados:

```
API Gateway escuchando en el puerto 8080
  /api/identity/* -> http://localhost:3001
  CORS permitido para: http://localhost:5173
```

### Pruebas

```powershell
npm test
npx jest -t "503"     # una prueba por nombre
```

Las pruebas usan un microservicio falso que devuelve lo que recibe, así comprueban qué reenvía el Gateway exactamente. No necesitan que identity esté corriendo.

### Postman

Importar `api-gateway.postman_collection.json`. Con identity y el Gateway corriendo, ejecutarla completa con el Collection Runner, en orden. Contiene las pruebas propias del Gateway y el flujo completo de identity entrando por el puerto 8080.

## 5. Variables de entorno

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `PORT` | Puerto del Gateway | `8080` |
| `JWT_SECRET` | **Obligatorio.** Mismo valor que en Identity Service | — |
| `JWT_ISSUER` / `JWT_AUDIENCE` | Mismos valores que en Identity Service | `carwash-identity` / `carwash-platform` |
| `IDENTITY_SERVICE_URL` | URL de Identity Service. En Docker será `http://identity:3001` | `http://localhost:3001` |
| `CATALOG_SERVICE_URL` | URL de Catalog Service | `http://localhost:3002` |
| `CUSTOMER_SERVICE_URL` | URL de Customer / Vehicle Service | `http://localhost:3005` |
| `WASH_ORDER_SERVICE_URL` | URL de Wash Order Service | `http://localhost:3000` |
| `PAYMENT_SERVICE_URL` | URL de Payment Service | `http://localhost:3003` |
| `NOTIFICATION_SERVICE_URL` | URL de Notification Service | `http://localhost:3004` |
| `CORS_ORIGINS` | Orígenes del frontend, separados por coma | `http://localhost:5173` |
| `PROXY_TIMEOUT_MS` | Tiempo máximo de espera de un servicio | `10000` |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | Solicitudes por IP y ventana | `300` / `60000` |

## 6. Errores del Gateway

Mismo formato que los microservicios: `{ "error": { "code": "...", "message": "..." } }`.

| Código HTTP | Código | Cuándo |
|---|---|---|
| 401 | `INVALID_TOKEN` | Falta el token, o es inválido o está vencido |
| 403 | `CORS_NOT_ALLOWED` | Petición de navegador desde un origen no permitido |
| 404 | `NOT_FOUND` | Ruta que ningún servicio atiende, o ruta interna bloqueada |
| 429 | `TOO_MANY_REQUESTS` | Se superó el límite de solicitudes por IP |
| 502 | `BAD_GATEWAY` | Error de comunicación inesperado con el servicio |
| 503 | `SERVICE_UNAVAILABLE` | El servicio está caído |
| 504 | `GATEWAY_TIMEOUT` | El servicio no respondió a tiempo |

Los errores propios de cada servicio, como 400, 403, 404 o 409, llegan al cliente sin cambios.

## 7. Pendiente

1. Docker: usar los nombres de los contenedores en las URLs de los servicios y publicar solo el puerto del Gateway.
