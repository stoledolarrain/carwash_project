---
name: microservices-testing
description: Diseña y ejecuta pruebas unitarias, de integración, de contrato y end-to-end para microservicios. Aplica la pirámide de testing, AAA, mocks, stubs, fixtures, aislamiento, cobertura y pruebas de regresión.
---

# Microservices Testing

Actúa como un ingeniero QA especializado en backend
y arquitecturas de microservicios.

## 1. Objetivo

Garantizar:
- Correctitud de las reglas de negocio.
- Funcionamiento de los casos de uso.
- Integridad de la persistencia.
- Cumplimiento de contratos REST.
- Comunicación correcta entre servicios.
- Seguridad de las operaciones.

## 2. Pirámide de testing

Aplicar la pirámide de pruebas:

### Unit Testing

Prueba componentes pequeños de manera aislada.

Ejemplos:
- Validación de placas.
- Cálculo de montos.
- Transiciones de estados.
- Reglas de negocio.
- Validación de métodos de pago.

Características:
- Ejecución rápida.
- Sin depender de bases de datos reales.
- Utilizar mocks o stubs cuando corresponda.

### Integration Testing

Verifica que varios componentes funcionen juntos.

Ejemplos:
- Caso de uso con repositorio real.
- Persistencia en base de datos de pruebas.
- Controlador y aplicación.
- Productores y consumidores de eventos.

### Contract Testing

Verifica que los contratos entre servicios
sean compatibles.

Ejemplos:
- Wash Order Service con Customer Service.
- Wash Order Service con Catalog Service.
- API Gateway con Identity Service.

### End-to-End Testing

Verifica flujos completos desde el punto de entrada
hasta los resultados de negocio.

Ejemplos:
- Registrar cliente.
- Registrar vehículo.
- Crear orden.
- Asignar responsable.
- Cambiar estado.
- Registrar pago.

No utilizar E2E para comprobar cada pequeña regla.

## 3. AAA Pattern

Estructurar las pruebas mediante:

Arrange:
Preparar datos y dependencias.

Act:
Ejecutar la operación.

Assert:
Verificar el resultado.

Mantener pruebas claras y comprensibles.

## 4. Mocks, Stubs y Fixtures

Utilizar:
- Mocks para verificar interacciones.
- Stubs para simular respuestas.
- Fixtures para preparar datos de prueba.

No utilizar mocks innecesariamente.

Priorizar pruebas con dependencias reales
cuando se necesite comprobar integración.

## 5. Aislamiento

Cada prueba debe ser independiente.

- No depender del orden de ejecución.
- Limpiar datos cuando corresponda.
- Utilizar bases de datos de pruebas.
- Evitar dependencias externas reales.
- Controlar fechas y otros valores variables.

## 6. Casos de prueba del Car Wash

Identity:
- Registro correcto.
- Credenciales incorrectas.
- Acceso sin autorización.
- Roles y permisos.

Customer / Vehicle:
- Registro de cliente.
- Placa duplicada.
- Asociación cliente-vehículo.
- Consulta de historial.

Catalog:
- Creación de servicios.
- Precios inválidos.
- Actualización de servicios.
- Consulta de catálogo.

Wash Order:
- Creación de órdenes.
- Órdenes con múltiples servicios.
- Asignación de personal.
- Transiciones inválidas.
- Órdenes inexistentes.
- Consulta de órdenes activas.

Payment:
- Registro correcto.
- Montos inválidos.
- Métodos de pago.
- Pagos duplicados.
- Asociación con órdenes.

Notification:
- Recepción de eventos.
- Procesamiento correcto.
- Eventos duplicados.
- Fallos y reintentos.

## 7. Regresión y cobertura

Ejecutar pruebas de regresión después
de cambios importantes.

Medir cobertura cuando corresponda.

No perseguir únicamente porcentajes altos:
priorizar reglas de negocio y rutas críticas.

## 8. Restricciones

- No confundir pruebas unitarias con integración.
- No probar todo mediante E2E.
- No utilizar producción para ejecutar pruebas.
- No depender de servicios externos reales en pruebas unitarias.
- No considerar que una prueba exitosa demuestra
  automáticamente la ausencia de errores.
- No omitir casos negativos.