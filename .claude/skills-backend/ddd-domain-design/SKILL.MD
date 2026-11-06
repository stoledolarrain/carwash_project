---
name: ddd-domain-design
description: Modela dominios de negocio utilizando Domain-Driven Design, entidades, objetos de valor, agregados, repositorios, servicios de dominio y bounded contexts. Utilizar al diseñar modelos, reglas de negocio y límites entre microservicios.
---

# Domain-Driven Design

Actúa como un especialista en Domain-Driven Design (DDD).

## 1. Principios

El dominio debe representar el negocio real.

Separar:
- Domain: reglas y conceptos del negocio.
- Application: coordinación de casos de uso.
- Infrastructure: implementaciones técnicas.
- Presentation/API: entrada y salida de información.

No colocar reglas de negocio en controladores
ni depender de detalles de infraestructura.

## 2. Bounded Contexts

Identificar límites de dominio independientes.

Para el Car Wash considerar:

- Identity Context.
- Customer and Vehicle Context.
- Catalog Context.
- Wash Order Context.
- Payment Context.
- Notification Context.

Cada contexto debe mantener sus propios modelos
y lenguaje de negocio.

No utilizar una misma entidad compartida
para representar conceptos diferentes en contextos distintos.

## 3. Entidades

Una entidad posee identidad propia.

Ejemplos:
- User.
- Customer.
- Vehicle.
- WashOrder.
- Payment.
- Service.

Definir sus atributos, identificadores y reglas.

## 4. Value Objects

Utilizar objetos de valor para conceptos que se
identifican por sus atributos y no por identidad.

Ejemplos:
- Money.
- VehiclePlate.
- PaymentMethod.
- OrderStatus.
- EstimatedDuration.

Cuando corresponda, validar sus valores desde
el propio objeto.

## 5. Aggregates

Agrupar entidades y objetos de valor que deben
mantener invariantes de negocio.

Definir una raíz de agregado responsable
de proteger dichas reglas.

Evitar agregados demasiado grandes.

## 6. Repositories

Definir interfaces de repositorio en el dominio
o en la capa de abstracción correspondiente.

Las implementaciones concretas pertenecen
a infraestructura.

Ejemplos:
- CustomerRepository.
- VehicleRepository.
- WashOrderRepository.
- PaymentRepository.

## 7. Domain Services

Utilizar servicios de dominio cuando una regla
no pertenezca naturalmente a una sola entidad.

No convertir los servicios de dominio
en contenedores de toda la lógica.

## 8. Casos del Car Wash

El dominio debe contemplar reglas como:

- Una orden puede contener varios servicios.
- Una orden corresponde a un vehículo.
- Un vehículo puede tener historial de órdenes.
- Una orden puede tener un responsable o equipo.
- Una orden cambia de estado siguiendo un flujo válido.
- Un pago registra monto, fecha y método.
- Un cambio de estado puede generar un evento.

Los estados y transiciones deben definirse
explícitamente con el equipo.

## 9. Restricciones

- No mezclar modelos de distintos bounded contexts.
- No permitir que el dominio dependa de ORM,
  frameworks, HTTP o bases de datos.
- No duplicar reglas de negocio.
- No crear entidades solamente para transportar datos.
- No inventar reglas no definidas por el proyecto.

Explicar qué conceptos pertenecen a cada dominio
y por qué.