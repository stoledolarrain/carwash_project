---
name: backend-security
description: Implementa seguridad en microservicios mediante autenticación, autorización, JWT, roles, permisos, validación de entradas, protección de datos y principio de mínimo privilegio. Utilizar al desarrollar autenticación, endpoints protegidos o comunicación entre servicios.
---

# Backend Security

Actúa como un especialista en seguridad de aplicaciones backend.

## 1. Principios

Aplicar:
- Least Privilege.
- Defense in Depth.
- Secure by Default.
- Separation of Duties.
- Fail Securely.

## 2. Autenticación

Identity Service es responsable de:

- Registro de usuarios.
- Inicio de sesión.
- Verificación de credenciales.
- Emisión y validación de tokens.
- Gestión de identidad.

Utilizar mecanismos seguros de almacenamiento
de contraseñas mediante algoritmos de hashing
diseñados para contraseñas, como Argon2 o bcrypt.

Nunca almacenar contraseñas en texto plano.

## 3. JWT

Cuando se utilicen JWT:

- Validar firma.
- Validar expiración.
- Validar emisor y audiencia cuando corresponda.
- Utilizar claves protegidas.
- Evitar información sensible en el payload.
- Gestionar adecuadamente renovación y revocación.

## 4. Autorización

Definir roles y permisos.

Ejemplos orientativos:

- Administrador.
- Recepcionista.
- Personal de lavado.

Los permisos deben corresponder a las funciones
reales de cada rol.

Ejemplos:
- Administrar usuarios.
- Administrar catálogo.
- Crear órdenes.
- Asignar responsables.
- Cambiar estados.
- Registrar pagos.
- Consultar reportes.

No asumir que autenticación significa autorización.

## 5. Protección de APIs

Aplicar:
- Validación de entradas.
- Control de acceso.
- Rate limiting.
- Protección contra inyección SQL.
- Manejo seguro de errores.
- Restricciones de tamaño.
- CORS configurado correctamente cuando corresponda.

## 6. Comunicación interna

Proteger la comunicación entre microservicios.

No confiar automáticamente en una solicitud
porque proviene de la red interna.

Utilizar credenciales y permisos específicos
para las comunicaciones necesarias.

## 7. Protección de datos

- No registrar contraseñas.
- No registrar tokens.
- No exponer datos sensibles en respuestas.
- Gestionar secretos mediante configuración segura.
- No subir archivos .env con credenciales.
- Limitar el acceso a información personal.

## 8. Restricciones

Nunca implementar autenticación ficticia
como mecanismo definitivo.

No utilizar contraseñas débiles.
No confiar exclusivamente en el frontend.
No otorgar permisos administrativos por defecto.
No exponer endpoints internos innecesariamente.