---
name: microservices-architecture
description: Diseña, organiza y desarrolla sistemas backend basados en microservicios, aplicando separación de responsabilidades, bajo acoplamiento, alta cohesión y comunicación entre servicios. Utilizar cuando se diseñe la arquitectura general, se creen microservicios o se modifiquen sus responsabilidades.
---

# Microservices Architecture

Actúa como un arquitecto de software especializado en microservicios.

## 1. Principios fundamentales

Aplicar:
- Single Responsibility Principle.
- High Cohesion.
- Low Coupling.
- Separation of Concerns.
- KISS, DRY y YAGNI.
- Principio de mínimo privilegio.

Cada microservicio debe tener una responsabilidad de negocio
claramente definida.

No crear microservicios innecesarios ni dividir el sistema
en servicios demasiado pequeños sin justificación.

## 2. Arquitectura del proyecto

El sistema es una plataforma de gestión para un Car Wash.

La arquitectura contempla los siguientes servicios:

1. Identity Service:
   - Registro de usuarios.
   - Autenticación.
   - Gestión de roles y permisos.

2. Customer / Vehicle Service:
   - Registro de clientes.
   - Registro de vehículos.
   - Asociación entre clientes y vehículos.
   - Consulta del historial básico.

3. Catalog Service:
   - Catálogo de servicios de lavado.
   - Precios.
   - Tiempos estimados.
   - Administración de servicios.

4. Wash Order Service:
   - Creación de órdenes de lavado.
   - Asociación de clientes y vehículos.
   - Selección de uno o varios servicios.
   - Asignación de responsables.
   - Gestión de estados.
   - Seguimiento de órdenes.

5. Payment Service:
   - Registro de pagos.
   - Monto recibido.
   - Fecha del pago.
   - Método de pago.
   - Asociación con órdenes.

6. Notification Service:
   - Notificaciones ante cambios de estado.
   - Simulación de avisos al cliente.
   - Procesamiento de eventos.

## 3. Independencia de los servicios

Cada microservicio debe:
- Tener su propia lógica de negocio.
- Administrar sus propios datos.
- Exponer contratos de comunicación.
- Evitar acceder directamente a la base de datos
  de otros microservicios.
- No compartir entidades internas.
- No depender de implementaciones internas de otros servicios.

La comunicación debe realizarse mediante APIs o eventos.

## 4. Comunicación

Elegir entre:
- Comunicación síncrona mediante HTTP/REST.
- Comunicación asíncrona mediante eventos.

Utilizar comunicación síncrona cuando se necesite
una respuesta inmediata.

Utilizar eventos cuando una acción deba informar
a otros servicios sin acoplarlos directamente.

## 5. Diseño y decisiones

Antes de crear un microservicio:
1. Identificar su responsabilidad.
2. Definir sus límites de dominio.
3. Identificar sus dependencias.
4. Definir sus datos.
5. Establecer sus contratos.
6. Determinar cómo se comunicará con otros servicios.

Justificar cada decisión arquitectónica.

## 6. Restricciones

- No implementar lógica de frontend.
- No utilizar una arquitectura monolítica como solución final.
- No compartir bases de datos para simplificar la comunicación.
- No crear dependencias circulares.
- No implementar comunicación innecesariamente compleja.
- No introducir herramientas que no sean necesarias.

Priorizar una arquitectura comprensible, mantenible,
testeable y defendible académicamente.