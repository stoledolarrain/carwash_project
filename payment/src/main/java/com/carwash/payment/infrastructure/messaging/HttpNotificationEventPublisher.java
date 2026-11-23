package com.carwash.payment.infrastructure.messaging;

import com.carwash.payment.application.commands.PaymentEventPublisher;
import com.carwash.payment.domain.Payment;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
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

            RestClient.RequestBodySpec request = restClient.post().uri(notificationUrl + "/api/notifications");
            // Notification exige JWT: se reenvía el token del usuario que registró el pago (ADMIN o RECEPTIONIST).
            String authorization = currentAuthorizationHeader();
            if (authorization != null) {
                request = request.header(HttpHeaders.AUTHORIZATION, authorization);
            }
            request.body(payload)
                    .retrieve()
                    .toBodilessEntity();

            System.out.println("📨 Evento PaymentRegistered enviado a Notification Service para orden " + payment.getOrderId());
        } catch (Exception e) {
            System.err.println("⚠️ No se pudo notificar al servicio de notificaciones: " + e.getMessage());
        }
    }

    /** Token JWT de la petición en curso, tomado del contexto de Spring Security ya verificado. */
    private static String currentAuthorizationHeader() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication instanceof JwtAuthenticationToken jwtAuthentication) {
            return "Bearer " + jwtAuthentication.getToken().getTokenValue();
        }
        return null;
    }
}