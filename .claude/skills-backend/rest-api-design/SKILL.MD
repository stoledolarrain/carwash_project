---
name: rest-api-design
description: Diseña APIs REST para microservicios aplicando recursos, métodos HTTP, códigos de estado, DTOs, validaciones, contratos, paginación y manejo de errores. Utilizar al crear endpoints, controladores o contratos de comunicación.
---

# REST API Design

Actúa como un arquitecto especializado en diseño de APIs REST.

## 1. Recursos

Representar los recursos mediante sustantivos.

Ejemplos:

- /customers
- /vehicles
- /services
- /wash-orders
- /payments
- /users

Evitar endpoints que representen acciones innecesariamente.

## 2. Métodos HTTP

Utilizar correctamente:

- GET: consultar.
- POST: crear.
- PUT: reemplazar.
- PATCH: modificar parcialmente.
- DELETE: eliminar.

Respetar la semántica de cada método.

## 3. Códigos HTTP

Utilizar correctamente:

- 200: operación exitosa.
- 201: recurso creado.
- 202: solicitud aceptada para procesamiento.
- 204: operación exitosa sin contenido.
- 400: solicitud incorrecta.
- 401: no autenticado.
- 403: sin permisos.
- 404: recurso no encontrado.
- 409: conflicto.
- 422: datos semánticamente inválidos.
- 500: error interno.
- 503: servicio temporalmente no disponible.

## 4. DTOs y contratos

Separar:
- DTO de entrada.
- DTO de salida.
- Entidades de dominio.
- Modelos de persistencia.

No exponer directamente las entidades internas.

Mantener contratos estables y documentados.

## 5. Validaciones

Validar:
- Campos obligatorios.
- Tipos de datos.
- Longitudes.
- Formatos.
- Identificadores.
- Restricciones del negocio.

Distinguir validación de entrada y validación de dominio.

## 6. Respuestas y errores

Mantener estructuras consistentes.

Ejemplo de respuesta exitosa:

{
  "data": {
    "id": "123",
    "status": "RECEIVED"
  }
}

Ejemplo de error:

{
  "error": {
    "code": "WASH_ORDER_NOT_FOUND",
    "message": "La orden no existe"
  }
}

No exponer información interna, credenciales,
consultas SQL ni trazas al cliente.

## 7. Buenas prácticas

- Versionar APIs cuando corresponda.
- Implementar paginación.
- Utilizar filtros y ordenamiento.
- Evitar respuestas excesivamente grandes.
- Documentar contratos.
- Considerar idempotencia en operaciones críticas.
- Mantener consistencia entre microservicios.

## 8. Restricciones

No implementar endpoints de frontend.
No mezclar controladores con reglas de negocio.
No utilizar métodos HTTP incorrectamente.
No devolver siempre HTTP 200.