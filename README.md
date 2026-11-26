# Plataforma de Gestión para Car Wash

## Información Académica

- **Materia:** Ingeniería Web III
- **Docente:** Ing. Gary Franco
- **Equipo de Desarrollo:** Daniel Morales, Jose Paulo Mercado, Luciana Ramos y Samir Toledo

## Descripción del Proyecto

Solución web diseñada para organizar la recepción, atención y seguimiento de vehículos durante la operación diaria de un lavadero. El sistema centraliza la información para facilitar la atención al cliente, permitiendo controlar los vehículos ingresados, los servicios solicitados, el personal responsable, el estado de cada lavado y el registro final del servicio.

## Arquitectura del Sistema

El proyecto está implementado bajo una arquitectura de microservicios en un entorno Monorepo, cumpliendo con los siguientes criterios técnicos estructurales:

- **API Gateway:** Actúa como punto de entrada único para el enrutamiento de peticiones hacia los microservicios internos.
- **Domain-Driven Design (DDD) y Arquitectura Limpia:** Separación estricta entre el dominio, los casos de uso y la infraestructura en cada servicio.
- **Persistencia Aislada:** Independencia de datos y bases de datos separadas para cada microservicio para garantizar el desacoplamiento.
- **CQRS (Command and Query Responsibility Segregation):** Separación de operaciones de escritura (comandos) y lectura (consultas) en los servicios que lo requieran.
- **Arquitectura Orientada a Eventos:** Comunicación asíncrona mediante un Message Broker para eventos de dominio (ej. `WashOrderCreated`, `WashStarted`, `PaymentRegistered`).
- **Patrones de Diseño:** Implementación justificada de patrones según las reglas de negocio del dominio.

## Estructura de Microservicios

La plataforma está compuesta por los siguientes módulos con responsabilidades delimitadas:

1. **Frontend Web:** Interfaz de usuario para la operación y administración del sistema.
2. **API Gateway:** Recepción y distribución de tráfico HTTP.
3. **Identity Service:** Gestión de registro, autenticación y control de roles de acceso.
4. **Customer / Vehicle Service:** Administración del registro de clientes, vehículos y su historial básico asociado.
5. **Catalog Service:** Mantenimiento del catálogo de servicios disponibles, configuración de precios y tiempos estimados.
6. **Wash Order Service:** Motor principal para la creación de órdenes, asignación de responsables y gestión del flujo de estados (Recepción, En espera, En proceso, Listo/entregado).
7. **Payment Service:** Procesamiento y registro de pagos, montos y métodos utilizados.
8. **Notification Service:** Emisión de avisos simulados accionados por cambios de estado en las órdenes de lavado.

## Estado Actual

Los seis microservicios y el API Gateway están implementados, conectados entre sí y verifican el JWT de Identity Service. El frontend todavía es la plantilla inicial de Vite.

| Servicio | Tecnología | Puerto interno | Base de datos |
|---|---|---|---|
| API Gateway | Node.js + Express | 8080 (publicado) | — |
| Identity | Node.js + Express | 3001 | `identity_db` |
| Catalog | Node.js + Express | 3002 | `catalog_db` |
| Payment | Java + Spring Boot | 3003 | `carwash_payments` |
| Notification | Node.js + Express | 3004 | `carwash_notifications` |
| Customer / Vehicle | Python + Django | 3005 | `customer_db` |
| Wash Order | Node.js + Express | 3000 | `carwash1` |
| Frontend | React + Vite (nginx) | 5173 (publicado) | — |

## Ejecución con Docker

Requiere Docker Desktop. Todo el sistema se levanta desde la raíz del repositorio:

```powershell
Copy-Item .env.example .env    # completar los secretos (ver comentarios del archivo)
docker compose up -d --build
docker compose ps              # esperar a que todos los servicios estén "healthy"
```

| Dirección | Qué es |
|---|---|
| `http://localhost:8080` | API Gateway: único punto de entrada a los microservicios |
| `http://localhost:8080/health/services` | Estado de los seis microservicios |
| `http://localhost:5173` | Frontend |
| `localhost:5433` | PostgreSQL, para conectarse desde pgAdmin (usuario `postgres`, contraseña `POSTGRES_PASSWORD` del `.env`) |
| `localhost:9092` | Kafka |

`docker-compose.yml` levanta:

- **Un PostgreSQL** con una base de datos independiente por microservicio, creadas por `docker/postgres/init/01-create-databases.sql`.
- **Kafka** en modo KRaft, sin Zookeeper, y un contenedor que crea los topics al inicio.
- **Los seis microservicios.** Customer usa tres contenedores: la API, el consumidor de eventos de Wash Order y el publicador de su outbox.
- **El API Gateway y el frontend.** Son los únicos, junto con PostgreSQL y Kafka, que publican puertos: los microservicios solo se alcanzan a través del Gateway.

Comandos útiles:

```powershell
docker compose logs -f wash-order   # ver los logs de un servicio
docker compose restart catalog      # reiniciar un servicio
docker compose down                 # detener todo (los datos se conservan)
docker compose down -v              # detener y borrar los datos de PostgreSQL y Kafka
```

Dentro de Docker los microservicios no usan sus propios archivos `.env`: toda la configuración sale del `.env` de la raíz. Los `.env` de cada carpeta sirven para ejecutar un servicio fuera de Docker durante el desarrollo.
