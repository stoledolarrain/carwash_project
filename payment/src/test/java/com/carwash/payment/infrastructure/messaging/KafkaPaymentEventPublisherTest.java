package com.carwash.payment.infrastructure.messaging;

import com.carwash.payment.domain.Payment;
import com.carwash.payment.domain.PaymentMethod;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Publicación de PaymentRegistered sin Kafka real: se verifica topic, clave y sobre del evento. */
class KafkaPaymentEventPublisherTest {

    private final ObjectMapper mapper = JsonMapper.builder().build();

    @SuppressWarnings("unchecked")
    private final KafkaTemplate<String, String> kafkaTemplate = mock(KafkaTemplate.class);

    private final Payment payment = new Payment(12L, "62c23933-fc8a-4bcd-96e9-63540643c56c", "Andrea Rojas",
            new BigDecimal("45.00"), PaymentMethod.QR, "REGISTERED", LocalDateTime.of(2026, 11, 26, 11, 0));

    @Test
    void publicaElSobreComunEnElTopicConLaOrdenComoClave() throws Exception {
        when(kafkaTemplate.send(anyString(), anyString(), anyString()))
                .thenReturn(CompletableFuture.completedFuture((SendResult<String, String>) null));

        new KafkaPaymentEventPublisher(kafkaTemplate, mapper, 1000).publishPaymentRegistered(payment);

        ArgumentCaptor<String> valor = ArgumentCaptor.forClass(String.class);
        verify(kafkaTemplate).send(org.mockito.ArgumentMatchers.eq("payment.payment.registered"),
                org.mockito.ArgumentMatchers.eq(payment.getOrderId()), valor.capture());

        JsonNode sobre = mapper.readTree(valor.getValue());
        assertThat(sobre.get("evento").asString()).isEqualTo("PaymentRegistered");
        assertThat(sobre.get("origen").asString()).isEqualTo("payment-service");
        assertThat(sobre.get("eventVersion").asInt()).isEqualTo(1);
        assertThat(sobre.get("eventId").asString()).hasSize(36);
        assertThat(sobre.get("aggregateId").asString()).isEqualTo("12");

        JsonNode datos = sobre.get("datos");
        assertThat(datos.get("orderId").asString()).isEqualTo(payment.getOrderId());
        assertThat(datos.get("customerName").asString()).isEqualTo("Andrea Rojas");
        assertThat(datos.get("amount").decimalValue()).isEqualByComparingTo("45.00");
        assertThat(datos.get("method").asString()).isEqualTo("QR");
    }

    @Test
    void siKafkaFallaElRegistroDelPagoNoSeInterrumpe() {
        when(kafkaTemplate.send(anyString(), anyString(), anyString()))
                .thenReturn(CompletableFuture.failedFuture(new RuntimeException("broker caído")));

        assertThatCode(() -> new KafkaPaymentEventPublisher(kafkaTemplate, mapper, 1000).publishPaymentRegistered(payment))
                .doesNotThrowAnyException();
    }
}
