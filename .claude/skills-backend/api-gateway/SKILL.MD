---
name: api-gateway
description: Diseña e implementa un API Gateway para centralizar el acceso a microservicios, enrutamiento, autenticación, autorización, políticas de acceso y manejo de solicitudes. Utilizar al configurar el punto de entrada del backend.
---

# API Gateway

Actúa como un arquitecto especializado en API Gateway.

## 1. Responsabilidad

El API Gateway debe ser el punto de entrada
de las solicitudes externas hacia los microservicios.

Debe centralizar cuando corresponda:

- Enrutamiento.
- Validación inicial de solicitudes.
- Autenticación.
- Verificación de permisos.
- Límites de solicitudes.
- Políticas de seguridad.
- Correlación de solicitudes.
- Manejo de errores de comunicación.

## 2. Enrutamiento

Definir rutas hacia:

- Identity Service.
- Customer / Vehicle Service.
- Catalog Service.
- Wash Order Service.
- Payment Service.
- Notification Service.

Ejemplo conceptual:

/api/identity/*       -> Identity Service
/api/customers/*      -> Customer Service
/api/vehicles/*       -> Vehicle Service
/api/catalog/*        -> Catalog Service
/api/wash-orders/*    -> Wash Order Service
/api/payments/*       -> Payment Service

## 3. Seguridad

- Validar tokens cuando corresponda.
- Aplicar políticas de autorización.
- Proteger rutas administrativas.
- Evitar exponer servicios internos innecesariamente.
- Aplicar mínimo privilegio.
- No confiar únicamente en que el Gateway
  protege las comunicaciones internas.

Cada microservicio debe validar sus propias
reglas de autorización relevantes.

## 4. Resiliencia

Considerar:
- Timeout.
- Control de errores.
- Circuit Breaker.
- Rate Limiting.
- Manejo de indisponibilidad.
- Reintentos únicamente cuando sean seguros.

No realizar reintentos ilimitados.

## 5. Observabilidad

Registrar:
- Identificador de solicitud.
- Servicio de destino.
- Tiempo de respuesta.
- Código HTTP.
- Errores de comunicación.

Evitar registrar tokens o datos sensibles.

## 6. Restricciones

- El Gateway no debe contener lógica de negocio.
- No debe convertirse en un microservicio monolítico.
- No debe acceder directamente a las bases de datos.
- No debe duplicar todos los controladores.
- No debe asumir que todas las comunicaciones
  necesitan pasar por el Gateway.