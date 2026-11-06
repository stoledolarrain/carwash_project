---
name: clean-architecture
description: Implementa Clean Architecture en microservicios separando dominio, aplicación, infraestructura y presentación. Utilizar al crear módulos, organizar código, definir dependencias o implementar casos de uso.
---

# Clean Architecture

Actúa como un arquitecto especializado en Clean Architecture.

## 1. Capas

Organizar cada microservicio mediante:

### Domain
Contiene:
- Entidades.
- Value Objects.
- Agregados.
- Reglas de negocio.
- Interfaces de repositorios cuando corresponda.
- Excepciones de dominio.

No debe depender de otras capas.

### Application
Contiene:
- Casos de uso.
- Commands.
- Queries.
- DTOs internos.
- Interfaces necesarias para ejecutar operaciones.
- Coordinación del flujo de negocio.

No debe implementar directamente detalles técnicos.

### Infrastructure
Contiene:
- Implementaciones de repositorios.
- Conexiones a bases de datos.
- ORM.
- Clientes HTTP.
- Productores y consumidores de eventos.
- Servicios externos.

### Presentation / API
Contiene:
- Controladores.
- Rutas.
- Validación de entrada.
- Serialización.
- Respuestas HTTP.
- Manejo de errores de presentación.

## 2. Dependency Rule

Las dependencias deben apuntar hacia el interior.

Domain no depende de Application, Infrastructure
ni Presentation.

Application no debe depender de implementaciones
concretas de Infrastructure.

Infrastructure implementa las interfaces necesarias
definidas por las capas internas.

## 3. Casos de uso

Cada operación importante debe tener una responsabilidad clara.

Ejemplos:
- RegisterCustomer.
- RegisterVehicle.
- CreateWashOrder.
- AssignWashOrder.
- ChangeWashOrderStatus.
- RegisterPayment.
- GetWashOrderHistory.

Los casos de uso deben coordinar operaciones
sin absorber responsabilidades ajenas.

## 4. Inyección de dependencias

Utilizar Dependency Injection para conectar
interfaces con implementaciones concretas.

Evitar crear dependencias rígidas directamente
dentro de los casos de uso.

## 5. Organización

Mantener módulos coherentes y fáciles de localizar.

Separar:
- Modelos de dominio.
- Casos de uso.
- Contratos.
- Implementaciones.
- Controladores.

## 6. Restricciones

- No colocar consultas SQL en controladores.
- No colocar reglas de negocio en infraestructura.
- No hacer que el dominio conozca HTTP.
- No mezclar DTOs de entrada con entidades de dominio.
- No crear capas vacías sin necesidad.
- No sobrecomplicar la estructura.

Toda implementación debe respetar la regla
de dependencia y facilitar las pruebas unitarias.