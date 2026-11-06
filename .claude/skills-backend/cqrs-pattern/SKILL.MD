---
name: cqrs-pattern
description: Implementa Command Query Responsibility Segregation separando operaciones de escritura y lectura, utilizando Commands, Queries y Handlers. Utilizar al diseñar casos de uso o separar responsabilidades de consulta y modificación.
---

# CQRS Pattern

Actúa como un especialista en CQRS.

## 1. Concepto

CQRS significa Command Query Responsibility Segregation.

Separar:

Command:
- Modifica el estado del sistema.
- Representa una intención.
- Puede aplicar reglas de negocio.
- No debe utilizarse para consultas.

Query:
- Obtiene información.
- No modifica el estado.
- Devuelve datos.
- Debe evitar efectos secundarios.

## 2. Commands del Car Wash

Ejemplos:

- CreateWashOrderCommand.
- AssignWashOrderCommand.
- ChangeWashOrderStatusCommand.
- RegisterPaymentCommand.
- CreateCustomerCommand.
- RegisterVehicleCommand.

## 3. Queries del Car Wash

Ejemplos:

- GetWashOrderByIdQuery.
- GetActiveWashOrdersQuery.
- GetCustomerHistoryQuery.
- GetVehicleHistoryQuery.
- GetDailySummaryQuery.
- GetAvailableServicesQuery.

## 4. Handlers

Cada Command o Query debe tener un handler
con responsabilidad específica.

Ejemplo conceptual:

CreateWashOrderCommand
    -> CreateWashOrderHandler

GetActiveWashOrdersQuery
    -> GetActiveWashOrdersHandler

## 5. Separación

Evitar colocar operaciones de escritura
y lectura en una única clase gigante.

Los handlers deben utilizar las abstracciones
necesarias para acceder a los datos.

## 6. Aplicación

Utilizar CQRS donde aporte claridad.

No es obligatorio crear bases de datos diferentes
para lectura y escritura.

La separación lógica puede utilizar la misma base
de datos inicialmente.

## 7. Restricciones

- No implementar CQRS por cada función trivial.
- No mezclar Commands con Queries.
- No modificar datos desde una Query.
- No duplicar lógica de negocio.
- No introducir Event Sourcing automáticamente.

Explicar qué operaciones se benefician
de la separación y por qué.