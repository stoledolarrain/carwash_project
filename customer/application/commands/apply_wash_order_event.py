"""Command: aplica de forma idempotente un evento de Wash Order a la proyección de historial."""

from __future__ import annotations

from application.dto.history_dto import IncomingWashOrderEvent, WashHistoryItemDto
from application.errors import InvalidRequestError
from application.ports.inbox_repository import InboxRepository
from application.ports.unit_of_work import UnitOfWork
from application.ports.wash_history_repository import WashHistoryRepository
from domain.value_objects.plate import Plate

SUPPORTED_ORDER_EVENTS = frozenset(
    {
        "WashOrderCreated",
        "WashStarted",
        "WashCompleted",
        "WashDelivered",
    }
)

ORDER_STATUS_RANK: dict[str, int] = {
    "EN_ESPERA": 1,
    "EN_PROCESO": 2,
    "LISTO": 3,
    "ENTREGADO": 4,
}


class ApplyWashOrderEvent:
    """Deduplica en Inbox y actualiza WashHistory dentro de una única transacción."""

    def __init__(
        self,
        *,
        inbox_repository: InboxRepository,
        history_repository: WashHistoryRepository,
        uow: UnitOfWork,
    ) -> None:
        self._inbox_repository = inbox_repository
        self._history_repository = history_repository
        self._uow = uow

    def execute(self, event: IncomingWashOrderEvent) -> str:
        """Procesa el evento y devuelve: 'applied', 'duplicate', 'stale_ignored' o 'ignored_unknown'."""
        if event.evento not in SUPPORTED_ORDER_EVENTS:
            return "ignored_unknown"

        if event.status not in ORDER_STATUS_RANK:
            raise InvalidRequestError(f"Estado de orden no soportado: '{event.status}'.")

        normalized_plate = Plate(event.plate).value

        with self._uow.atomic():
            is_new = self._inbox_repository.register_if_new(
                event_id=event.event_id,
                evento=event.evento,
                aggregate_id=event.aggregate_id,
                topic=event.topic,
            )
            if not is_new:
                return "duplicate"

            existing = self._history_repository.find_by_order_id(event.order_id)
            if existing is not None:
                if ORDER_STATUS_RANK[event.status] < ORDER_STATUS_RANK[existing.status]:
                    # Nunca retrocedemos el estado de una orden ya más avanzada.
                    return "stale_ignored"

            delivered_at = event.delivered_at
            if delivered_at is None and existing is not None:
                delivered_at = existing.delivered_at

            responsible_id = event.responsible_id
            if responsible_id is None and existing is not None:
                responsible_id = existing.responsible_id

            item = WashHistoryItemDto(
                order_id=event.order_id,
                plate=normalized_plate,
                customer_id=event.customer_id,
                services=event.services,
                total_price=event.total_price,
                responsible_id=responsible_id,
                status=event.status,
                created_at=event.created_at,
                delivered_at=delivered_at,
                last_event_at=event.occurred_at,
            )
            self._history_repository.upsert(item)

        return "applied"
