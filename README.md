# Plataforma de Gestión para Car Wash

## Información Académica

- **Materia:** Ingeniería Web III
- **Docente:** Ing. Gary Franco
- **Equipo de Desarrollo:** Daniel Morales, Jose Paulo Mercado, Luciana Ramos, Samir Toledo y [Tu Nombre/Apellidos]

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

El proyecto se encuentra en fase de inicialización. Se ha definido la estructura base del Monorepo y se ha creado el esqueleto de la aplicación Frontend.
