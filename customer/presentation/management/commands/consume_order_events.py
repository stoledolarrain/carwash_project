"""Comando Django para consumir eventos de Wash Order desde Kafka con Inbox idempotente."""

from __future__ import annotations

import signal

from django.core.management.base import BaseCommand

from config.container import build_order_event_consumer, get_container


class Command(BaseCommand):
    help = "Consume eventos de órdenes desde Apache Kafka y actualiza la proyección de historial."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--max-messages",
            type=int,
            default=None,
            help="Detiene el consumidor tras procesar N mensajes (útil para pruebas).",
        )
        parser.add_argument(
            "--poll-timeout",
            type=float,
            default=1.0,
            help="Tiempo de espera de cada poll en segundos (por defecto 1.0).",
        )

    def handle(self, *args, **options) -> None:
        container = get_container()
        consumer_service = build_order_event_consumer(container=container)

        stop = False

        def _handle_stop(_signum, _frame) -> None:
            nonlocal stop
            stop = True

        signal.signal(signal.SIGINT, _handle_stop)
        signal.signal(signal.SIGTERM, _handle_stop)

        topics = ", ".join(container.config.kafka.order_event_topics)
        self.stdout.write(
            f"Iniciando consumidor consume_order_events en topic(s): {topics}..."
        )
        processed = consumer_service.run_forever(
            poll_timeout_seconds=options["poll_timeout"],
            max_messages=options["max_messages"],
            stop_requested=lambda: stop,
        )
        self.stdout.write(
            f"Consumidor consume_order_events detenido (mensajes procesados: {processed})."
        )
