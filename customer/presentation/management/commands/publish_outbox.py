"""Comando Django para publicar eventos pendientes de outbox_events en Apache Kafka."""

from __future__ import annotations

import signal

from django.core.management.base import BaseCommand

from config.container import build_outbox_publisher


class Command(BaseCommand):
    help = "Publica eventos pendientes de outbox_events en Apache Kafka (Transactional Outbox)."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--once",
            action="store_true",
            help="Procesa un único lote de eventos pendientes y finaliza.",
        )
        parser.add_argument(
            "--batch-size",
            type=int,
            default=None,
            help="Cantidad máxima de eventos por lote (sobrescribe OUTBOX_BATCH_SIZE).",
        )
        parser.add_argument(
            "--poll-interval-ms",
            type=int,
            default=None,
            help="Intervalo de sondeo en milisegundos (sobrescribe OUTBOX_POLL_INTERVAL_MS).",
        )

    def handle(self, *args, **options) -> None:
        publisher = build_outbox_publisher(
            batch_size=options["batch_size"],
            poll_interval_ms=options["poll_interval_ms"],
        )

        if options["once"]:
            stats = publisher.publish_once()
            self.stdout.write(
                f"Outbox procesado: processed={stats['processed']} "
                f"published={stats['published']} failed={stats['failed']}"
            )
            return

        stop = False

        def _handle_stop(_signum, _frame) -> None:
            nonlocal stop
            stop = True

        signal.signal(signal.SIGINT, _handle_stop)
        signal.signal(signal.SIGTERM, _handle_stop)

        self.stdout.write("Iniciando worker publish_outbox hacia Apache Kafka...")
        publisher.run_forever(stop_requested=lambda: stop)
        self.stdout.write("Worker publish_outbox detenido.")
