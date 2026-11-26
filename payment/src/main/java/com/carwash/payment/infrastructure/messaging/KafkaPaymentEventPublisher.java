package com.carwash.payment.infrastructure.messaging;

import com.carwash.payment.application.commands.PaymentEventPublisher;
import com.carwash.payment.domain.Payment;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Publica el evento de dominio PaymentRegistered en Kafka (topic payment.payment.registered).
 *
 * Usa el mismo sobre que el resto de microservicios: eventId, evento, origen, eventVersion,
 * fechaEmision, aggregateId y datos. La clave del mensaje es el id de la orden, así todos los
 * eventos de una misma orden quedan ordenados en la misma partición.
 *
 * Notification consume este topic para avisar al cliente; Payment no sabe quién lo escucha.
 * Si Kafka no responde a tiempo, el pago igual queda registrado y el fallo se informa en el log
 * (para no perder eventos en ningún caso haría falta un Transactional Outbox, como en Catalog).
 */
@Component
public class KafkaPaymentEventPublisher implements PaymentEventPublisher {

    static final String TOPIC = "payment.payment.registered";
    static final String ORIGEN = "payment-service";

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;
    private final long sendTimeoutMs;

    public KafkaPaymentEventPublisher(KafkaTemplate<String, String> kafkaTemplate,
                                      ObjectMapper objectMapper,
                                      @Value("${kafka.send-timeout-ms:5000}") long sendTimeoutMs) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
        this.sendTimeoutMs = sendTimeoutMs;
    }

    @Override
    public void publishPaymentRegistered(Payment payment) {
        String json = objectMapper.writeValueAsString(buildEnvelope(payment));
        try {
            kafkaTemplate.send(TOPIC, payment.getOrderId(), json).get(sendTimeoutMs, TimeUnit.MILLISECONDS);
            System.out.println("[KAFKA PUBLICADO] topic=" + TOPIC + " key=" + payment.getOrderId() + " evento=PaymentRegistered");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            System.err.println("[KAFKA AVISO] Publicación interrumpida para la orden " + payment.getOrderId());
        } catch (Exception e) {
            System.err.println("[KAFKA AVISO] No se pudo publicar PaymentRegistered de la orden " + payment.getOrderId()
                    + " (el pago sí quedó registrado): " + e.getMessage());
        }
    }

    Map<String, Object> buildEnvelope(Payment payment) {
        Map<String, Object> datos = new LinkedHashMap<>();
        datos.put("id", String.valueOf(payment.getId()));
        datos.put("orderId", payment.getOrderId());
        datos.put("customerName", payment.getCustomerName());
        datos.put("amount", payment.getAmount());
        datos.put("method", payment.getMethod().name());
        datos.put("status", payment.getStatus());
        datos.put("paidAt", payment.getPaidAt().toString());

        Map<String, Object> envelope = new LinkedHashMap<>();
        envelope.put("eventId", UUID.randomUUID().toString());
        envelope.put("evento", "PaymentRegistered");
        envelope.put("origen", ORIGEN);
        envelope.put("eventVersion", 1);
        envelope.put("fechaEmision", Instant.now().toString());
        envelope.put("aggregateId", String.valueOf(payment.getId()));
        envelope.put("datos", datos);
        return envelope;
    }
}
