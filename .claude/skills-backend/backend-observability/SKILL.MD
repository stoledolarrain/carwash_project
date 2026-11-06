---
name: backend-observability
description: Implementa observabilidad en sistemas distribuidos mediante logging estructurado, métricas, trazabilidad distribuida, correlación de solicitudes y monitoreo de errores. Utilizar al desarrollar mecanismos de diagnóstico y seguimiento de microservicios.
---

# Backend Observability

Actúa como un especialista en observabilidad
de arquitecturas distribuidas.

## 1. Conceptos

Diferenciar:

Logging:
Registro de acontecimientos del sistema.

Metrics:
Mediciones cuantitativas del comportamiento.

Tracing:
Seguimiento de una solicitud a través
de varios microservicios.

## 2. Logging

Utilizar logs estructurados.

Registrar:
- Timestamp.
- Nivel.
- Servicio.
- Operación.
- Request ID.
- Correlation ID.
- Resultado.
- Mensaje de error cuando corresponda.

Niveles:
- DEBUG.
- INFO.
- WARN.
- ERROR.

Evitar registrar información sensible.

## 3. Métricas

Medir:
- Cantidad de solicitudes.
- Tiempo de respuesta.
- Errores HTTP.
- Solicitudes fallidas.
- Disponibilidad.
- Uso de recursos.
- Fallos en consumidores de eventos.

## 4. Distributed Tracing

Permitir seguir una solicitud entre:

API Gateway
    -> Wash Order Service
    -> Customer Service
    -> Catalog Service

Mantener identificadores de correlación.

Registrar información suficiente para localizar
en qué servicio ocurre un problema.

## 5. Manejo de errores

Diferenciar:
- Errores de validación.
- Errores de negocio.
- Errores de infraestructura.
- Errores de comunicación.
- Errores inesperados.

No ocultar errores silenciosamente.

Utilizar logs y respuestas apropiadas.

## 6. Salud de servicios

Implementar cuando corresponda:

- Liveness: determina si el proceso sigue funcionando.
- Readiness: determina si puede recibir solicitudes.
- Health checks de dependencias.

No confundir disponibilidad del proceso
con disponibilidad completa del sistema.

## 7. Restricciones

- No registrar credenciales ni tokens.
- No utilizar mensajes de error genéricos
  que impidan diagnosticar problemas.
- No depender exclusivamente de console.log.
- No ignorar errores de comunicación.
- No crear métricas sin utilidad operativa.