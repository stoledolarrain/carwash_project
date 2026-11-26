# Frontend: AquaBrillo Car Wash

Aplicación React 19 + Vite que consume **solo el API Gateway**. Tiene dos partes:

- **Sitio público** (`/`): portada, servicios y precios leídos en vivo de Catalog (`GET /api/catalog/services`, sin token), pasos de atención y contacto.
- **Panel interno** (`/panel/...`): requiere iniciar sesión (`/ingresar`) con una cuenta creada por el administrador en Identity.

## Pantallas del panel

| Ruta | Pantalla | Roles | Microservicios |
|---|---|---|---|
| `/panel` | Resumen del día | Todos | wash_order, payment |
| `/panel/recepcion` | Placa → cliente → servicios → orden | ADMIN, RECEPTIONIST | customer, catalog, wash_order |
| `/panel/lavados` | Cola en columnas por estado (se refresca cada 10 s) | Todos | wash_order |
| `/panel/clientes` | Búsqueda, vehículos e historial | ADMIN, RECEPTIONIST | customer |
| `/panel/pagos` | Cobros pendientes y registro de pagos | ADMIN, RECEPTIONIST | payment, wash_order |
| `/panel/avisos` | Avisos generados por eventos de Kafka | ADMIN, RECEPTIONIST | notification |
| `/panel/servicios` | Catálogo: crear, editar, precio, activar | ADMIN | catalog |
| `/panel/usuarios` | Cuentas, roles y contraseñas | ADMIN | identity |

El menú y la protección de rutas salen de `src/config/navigation.js`. Agregar una pantalla es agregar una entrada ahí y su componente en `src/App.jsx`. Los roles se controlan de verdad en el Gateway y en cada microservicio; el frontend solo oculta lo que el usuario no puede usar.

## Estructura

```
src/
├── api/client.js        # fetch con token, lectura de los dos formatos de error, cierre de sesión ante 401
├── api/services.js      # un objeto por microservicio con sus endpoints
├── auth/AuthContext.jsx # login, sesión en localStorage, cierre al vencer el JWT (1 h)
├── config/navigation.js # pantallas por rol, estados de orden, métodos de pago
├── components/          # layout del panel, ui (botones, modales, badges), íconos, toasts
├── hooks/               # useApi (carga + recarga + refresco), usePersonal
├── pages/public/        # Inicio y Login
├── pages/panel/         # una pantalla por archivo
└── styles/theme.css     # paleta y tipografías (variables CSS); app.css usa solo esas variables
```

## Ejecución

Con el backend corriendo en Docker (`docker compose up -d` en la raíz):

```powershell
cd frontend
npm install
npm run dev      # http://localhost:5173 (o el siguiente puerto libre)
```

El frontend llama a rutas relativas (`/api/...`). En desarrollo Vite las reenvía al Gateway (`http://localhost:8080`, o `GATEWAY_URL` en un `.env`); en Docker lo hace nginx (`nginx.conf`). Por eso no hay problemas de CORS sin importar el puerto.

Para la versión de producción en Docker: `docker compose up -d --build frontend`.

```powershell
npm run lint
npm run build
```

## Pendiente del backend que el frontend cubre por ahora

- Wash Order no consulta precios en Catalog: Recepción calcula `precioTotal` con los precios oficiales del catálogo.
- Solo el ADMIN puede listar usuarios, así que el RECEPTIONIST escribe el nombre del responsable al iniciar un lavado (el ADMIN lo elige de una lista de lavadores).
