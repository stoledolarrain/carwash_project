# Customer / Vehicle Service

Microservicio responsable de administrar los **clientes**, sus **vehículos identificados por placa** y la consulta del **historial básico de atención** dentro de la **Plataforma de Gestión para Car Wash** (Ingeniería Web III).

> **Estado actual (Paso 3 de 10):** Estructura base del proyecto, entorno virtual independiente, configuración inicial de Django / DRF, validación de variables de entorno y pruebas de arquitectura/configuración listas. Las entidades de dominio, casos de uso, modelos ORM, endpoints REST y mensajería Kafka se implementarán en los pasos siguientes.

---

## Responsabilidad

- Administrar el registro y actualización de clientes y vehículos identificados por placa.
- Mantener una proyección local del historial de atención por cliente o vehículo a partir de eventos de **Wash Order Service** (sin ser propietario de las órdenes originales).
- Operar de forma independiente con su propia base de datos PostgreSQL (`customer_db`), sin compartir tablas ni modificar otros microservicios.

---

## Tecnologías utilizadas

- **Lenguaje:** Python 3.13 (`3.13.16`)
- **Framework web y API:** Django 5.2 LTS (`5.2.19`) y Django REST Framework (`3.18.3`)
- **Base de datos:** PostgreSQL mediante `psycopg[binary]` 3 (`3.3.9`)
- **Autenticación JWT (validación):** `PyJWT` (`2.15.1`)
- **Variables de entorno:** `python-dotenv` (`1.2.4`)
- **Mensajería Kafka:** `confluent-kafka` (`2.16.1`)
- **Pruebas:** `pytest` (`9.2.0`) y `pytest-django` (`4.14.0`)

---

## Configuración asignada

- **Puerto HTTP:** `3003`
- **Base de datos PostgreSQL exclusiva:** `customer_db` (la configuración rechaza conectarse a bases de datos de otros servicios como `catalog_db` o `identity_db`)

---

## Requisitos previos

- **Python 3.13** instalado en el equipo.
- **PostgreSQL 18** en ejecución con la base de datos `customer_db` creada (requerido cuando se utilice persistencia y migraciones; la configuración inicial permite cargar Django y ejecutar pruebas unitarias sin PostgreSQL activo).
- **Apache Kafka** en ejecución (requerido únicamente cuando se utilicen los procesos de publicación Outbox o consumo de eventos).

---

## Preparación del entorno (Windows PowerShell)

### 1. Crear y activar el entorno virtual independiente

```powershell
cd customer
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 2. Instalar dependencias

Para desarrollo y pruebas (incluye las dependencias de producción):

```powershell
python -m pip install -r requirements-dev.txt
```

Solo dependencias de producción:

```powershell
python -m pip install -r requirements.txt
```

### 3. Configurar variables de entorno

Copia `.env.example` a `.env` (ignorado por Git) y completa las credenciales locales:

```powershell
Copy-Item .env.example .env
```

Asegúrate de que `DATABASE_URL` apunte exclusivamente a `customer_db` y que `JWT_SECRET`, `JWT_ISSUER` y `JWT_AUDIENCE` coincidan con Identity Service y API Gateway cuando se integren.

---

## Ejecución y pruebas

### Verificar la configuración de Django

```powershell
python manage.py check
```

### Iniciar el servidor de desarrollo en el puerto 3003

```powershell
python manage.py runserver 3003
```

### Ejecutar las pruebas automatizadas

```powershell
pytest
```

---

## Estructura de capas (Clean Architecture)

```text
customer/
├── manage.py
├── pytest.ini
├── requirements.txt
├── requirements-dev.txt
├── .env.example
├── .gitignore
├── config/             # Configuración Django, env.py y composición inicial (container.py)
├── domain/             # Entidades y objetos de valor (sin dependencias de Django/DRF/Kafka)
├── application/        # Commands, Queries, DTOs y puertos
├── infrastructure/     # App Django: repositorios, ORM, migraciones, Kafka y seguridad JWT
├── presentation/       # App Django: vistas DRF y comandos de gestión
└── tests/              # Pruebas unitarias (unit/) y de integración (integration/)
```
