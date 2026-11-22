package com.carwash.payment.infrastructure.messaging;

import com.carwash.payment.application.commands.PaymentEventPublisher;
import com.carwash.payment.domain.Payment;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Map;

@Component
public class HttpNotificationEventPublisher implements PaymentEventPublisher {

    private final RestClient restClient;
    private final String notificationUrl;

    public HttpNotificationEventPublisher(@Value("${notification.service.url}") String notificationUrl) {
        this.notificationUrl = notificationUrl;
        this.restClient = RestClient.create();
    }

    @Override
    public void publishPaymentRegistered(Payment payment) {
        try {
            Map<String, Object> payload = Map.of(
                    "orderId", payment.getOrderId(),
                    "customerName", payment.getCustomerName(),
                    "eventType", "PaymentRegistered",
                    "customMessage", String.format("Gracias %s, registramos tu pago de Bs %s vía %s (Orden %s).",
                            payment.getCustomerName(), payment.getAmount(), payment.getMethod(), payment.getOrderId())
            );

            restClient.post()
                    .uri(notificationUrl + "/api/notifications")
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();

            System.out.println("📨 Evento PaymentRegistered enviado a Notification Service para orden " + payment.getOrderId());
        } catch (Exception e) {
            System.err.println("⚠️ No se pudo notificar al servicio de notificaciones: " + e.getMessage());
        }
    }
}