---
name: microservices-persistence
description: Diseña la persistencia de datos en microservicios, aplicando Database per Service, repositorios, transacciones, integridad, migraciones y consistencia de datos. Utilizar al diseñar modelos, consultas o acceso a bases de datos.
---

# Microservices Persistence

Actúa como un arquitecto especializado en persistencia
de datos para microservicios.

## 1. Database per Service

Cada microservicio debe ser propietario de sus datos.

Distribución conceptual:

Identity Service:
- Usuarios.
- Credenciales.
- Roles.
- Permisos.

Customer / Vehicle Service:
- Clientes.
- Vehículos.
- Relaciones cliente-vehículo.

Catalog Service:
- Servicios.
- Precios.
- Duraciones estimadas.

Wash Order Service:
- Órdenes.
- Detalles de órdenes.
- Asignaciones.
- Estados.

Payment Service:
- Pagos.
- Métodos.
- Registros de pago.

Notification Service:
- Notificaciones.
- Estado de procesamiento.
- Historial de envíos.

## 2. Independencia

- No acceder directamente a tablas de otro servicio.
- No compartir conexiones de repositorios.
- No crear claves foráneas entre bases de datos
  pertenecientes a distintos microservicios.
- Utilizar APIs o eventos para obtener información externa.
- Mantener identificadores de referencia.

## 3. Repositories

Implementar repositorios para abstraer
el acceso a datos.

Ejemplos:
- save()
- findById()
- findAll()
- update()
- delete()

Las operaciones deben responder a las necesidades
del dominio y no convertirse en métodos genéricos
sin justificación.

## 4. Transacciones

Utilizar transacciones locales para mantener
la consistencia dentro de cada servicio.

No asumir que una transacción SQL puede abarcar
todos los microservicios.

Para operaciones distribuidas considerar:
- Saga Pattern.
- Compensating Transactions.
- Transactional Outbox.

Introducir estos mecanismos solamente cuando
el flujo del negocio lo requiera.

## 5. Datos relacionados

Cuando un servicio necesite información de otro,
utilizar identificadores y contratos de comunicación.

Ejemplo:
Una WashOrder puede almacenar customerId,
vehicleId y los datos necesarios del servicio
seleccionado.

Evaluar la conservación de snapshots de precios
para que una orden histórica no cambie cuando
el catálogo actualice sus precios.

## 6. Migraciones

- Versionar cambios de esquema.
- No modificar esquemas manualmente sin control.
- Mantener migraciones reproducibles.
- Probar cambios antes de aplicarlos.
- Evitar cambios incompatibles entre versiones.

## 7. Restricciones

- No compartir una única base de datos lógica
  entre todos los servicios como solución final.
- No utilizar SQLite como sustituto de una
  arquitectura de persistencia adecuada.
- No colocar SQL en controladores.
- No almacenar contraseñas en texto plano.
- No perder historial de operaciones importantes.