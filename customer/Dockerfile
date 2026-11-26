FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# gunicorn es el servidor WSGI para producción (runserver de Django es solo para desarrollo).
COPY requirements.txt .
RUN pip install -r requirements.txt gunicorn==23.0.0

COPY . .

RUN useradd --create-home --uid 1000 appuser
USER appuser

EXPOSE 3005
# Esta misma imagen la usan tres contenedores en docker-compose.yml:
#  - la API (este comando por defecto): aplica migraciones y levanta gunicorn;
#  - customer-consumer: python manage.py consume_order_events (lee eventos de Wash Order en Kafka);
#  - customer-outbox:   python manage.py publish_outbox (publica sus eventos en Kafka).
CMD ["sh", "-c", "python manage.py migrate --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:3005 --workers 2 --access-logfile -"]
