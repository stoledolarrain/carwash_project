---
name: solid-design-patterns
description: Aplica SOLID, Clean Code, KISS, DRY, YAGNI y patrones de diseño GoF en el backend. Utilizar cuando se diseñen clases, servicios, interfaces, estrategias, adaptadores o se necesite reducir acoplamiento.
---

# SOLID and Design Patterns

Actúa como un especialista en diseño de software.

## 1. Principios SOLID

### Single Responsibility
Cada clase debe tener una responsabilidad clara.

### Open/Closed
Permitir extensiones sin modificar innecesariamente
el comportamiento existente.

### Liskov Substitution
Las implementaciones deben respetar los contratos
de sus abstracciones.

### Interface Segregation
Preferir interfaces pequeñas y específicas.

### Dependency Inversion
Depender de abstracciones y no de implementaciones
concretas.

## 2. Clean Code

Aplicar:
- KISS: mantener soluciones simples.
- DRY: evitar duplicación real de lógica.
- YAGNI: implementar solamente lo necesario.
- Nombres claros y descriptivos.
- Funciones pequeñas y enfocadas.
- Manejo explícito de errores.
- Código fácil de probar y mantener.

## 3. Patrones creacionales

Considerar:
- Factory Method: creación de objetos según condiciones.
- Abstract Factory: familias de objetos relacionados.
- Builder: construcción de objetos complejos.
- Prototype: clonación de objetos cuando sea necesaria.
- Singleton: instancia única cuando esté justificada.

## 4. Patrones estructurales

Considerar:
- Adapter: adaptar interfaces incompatibles.
- Bridge: separar abstracción e implementación.
- Composite: estructuras jerárquicas.
- Decorator: agregar responsabilidades.
- Facade: simplificar subsistemas.
- Flyweight: compartir objetos para ahorrar recursos.
- Proxy: controlar acceso a otros objetos o servicios.

## 5. Patrones de comportamiento

Considerar:
- Chain of Responsibility: encadenar procesamientos.
- Command: encapsular operaciones.
- Iterator: recorrer colecciones.
- Mediator: coordinar objetos.
- Memento: conservar estados anteriores.
- Observer: notificar cambios.
- State: gestionar comportamientos según estados.
- Strategy: intercambiar algoritmos.
- Template Method: definir pasos de un algoritmo.
- Visitor: agregar operaciones sobre estructuras.

## 6. Aplicación en el Car Wash

Ejemplos posibles:

- Strategy para distintos métodos de cálculo
  o políticas de precios.
- State para controlar transiciones de órdenes.
- Factory Method para crear notificaciones.
- Adapter para integrar proveedores externos.
- Observer para reaccionar a eventos.
- Chain of Responsibility para validaciones.

Estos son ejemplos, no implementaciones obligatorias.

## 7. Reglas de aplicación

Antes de introducir un patrón:
1. Identificar el problema.
2. Explicar por qué es necesario.
3. Seleccionar el patrón adecuado.
4. Evaluar su complejidad.
5. Implementarlo únicamente si aporta valor.

Nunca utilizar patrones por obligación
ni crear abstracciones innecesarias.