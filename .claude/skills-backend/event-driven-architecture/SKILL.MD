---
name: event-driven-architecture
description: Diseña comunicación asíncrona basada en eventos de dominio e integración entre microservicios. Utilizar al publicar, consumir, procesar o reaccionar a eventos de negocio.
---

# Event Driven Architecture

Actúa como un arquitecto especializado en sistemas
orientados a eventos.

## 1. Conceptos

Diferenciar:

- Domain Event: representa algo importante que ocurrió
  dentro de un dominio.
- Integration Event: comunica un hecho relevante
  hacia otros microservicios.
- Event Producer: publica eventos.
- Event Consumer: recibe y procesa eventos.

## 2. Eventos del Car Wash

Considerar los siguientes eventos:

- WashOrderCreated.
- WashStarted.
- WashCompleted.
- PaymentRegistered.

Cada evento debe representar un hecho ocurrido,
no una orden para ejecutar una acción.

## 3. Flujo de ejemplo

1. Wash Order Service crea una orden.
2. Publica WashOrderCreated.
3. Notification Service recibe el evento.
4. Notification Service procesa la notificación.

Otro flujo:

1. Wash Order Service cambia el estado.
2. Publica WashCompleted.
3. Notification Service recibe el evento.
4. Se genera un aviso de finalización.

## 4. Contratos de eventos

Definir:
- Event ID.
- Event type.
- Event version.
- Occurrence timestamp.
- Aggregate ID.
- Correlation ID.
- Event payload.

Ejemplo conceptual:

{
  "eventId": "uuid",
  "eventType": "WashOrderCreated",
  "eventVersion": 1,
  "occurredAt": "2026-11-06T12:00:00Z",
  "aggregateId": "order-123",
  "payload": {
    "orderId": "order-123",
    "vehicleId": "vehicle-456"
  }
}

## 5. Fiabilidad

Considerar:

- Reintentos controlados.
- Idempotencia de consumidores.
- Manejo de eventos duplicados.
- Dead Letter Queue cuando corresponda.
- Orden de procesamiento cuando sea necesario.
- Persistencia de eventos pendientes.
- Versionado de contratos.

## 6. Transactional Outbox

Cuando una operación de negocio y la publicación
de un evento deban mantenerse consistentes,
considerar Transactional Outbox.

Evitar guardar datos en la base de datos y publicar
eventos como dos operaciones independientes
sin contemplar posibles fallos.

## 7. Consistencia

Comprender que la comunicación asíncrona puede
generar consistencia eventual.

No asumir que todos los microservicios reciben
un evento inmediatamente.

## 8. Restricciones

- No utilizar eventos para toda operación.
- No publicar entidades completas.
- No incluir contraseñas ni tokens.
- No asumir entrega exactamente una vez.
- No crear dependencias circulares.
- No acoplar consumidores a implementaciones internas.