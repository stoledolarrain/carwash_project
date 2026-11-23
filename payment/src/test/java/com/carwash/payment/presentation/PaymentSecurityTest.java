package com.carwash.payment.presentation;

import com.carwash.payment.application.commands.RegisterPaymentCommand;
import com.carwash.payment.application.queries.GetPaymentsQuery;
import com.carwash.payment.domain.Payment;
import com.carwash.payment.domain.PaymentMethod;
import com.carwash.payment.infrastructure.security.SecurityConfig;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Date;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Seguridad de Payment sin base de datos: controlador real + SecurityConfig real, casos de uso simulados.
 * Los tokens se firman igual que Identity Service (HS256, sub, role, iss, aud, exp).
 */
@WebMvcTest(PaymentController.class)
@Import(SecurityConfig.class)
@TestPropertySource(properties = {
        "jwt.secret=" + PaymentSecurityTest.SECRET,
        "jwt.issuer=carwash-identity",
        "jwt.audience=carwash-platform"
})
class PaymentSecurityTest {

    static final String SECRET = "secreto-de-pruebas-de-payment-con-mas-de-32-caracteres";

    @Autowired
    MockMvc mvc;

    @MockitoBean
    RegisterPaymentCommand registerPaymentCommand;

    @MockitoBean
    GetPaymentsQuery getPaymentsQuery;

    private static String token(String role, String secret, String audience, Instant expiresAt) throws Exception {
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .subject("11111111-1111-4111-8111-111111111111")
                .issuer("carwash-identity")
                .audience(audience)
                .claim("role", role)
                .claim("tv", 0)
                .issueTime(new Date())
                .expirationTime(Date.from(expiresAt))
                .build();
        SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims);
        jwt.sign(new MACSigner(secret.getBytes(StandardCharsets.UTF_8)));
        return "Bearer " + jwt.serialize();
    }

    private static String token(String role) throws Exception {
        return token(role, SECRET, "carwash-platform", Instant.now().plusSeconds(600));
    }

    private static final String PAYMENT_BODY =
            "{\"orderId\":\"o-1\",\"customerName\":\"Ana\",\"amount\":60,\"method\":\"QR\"}";

    @Test
    void healthEsPublico() throws Exception {
        mvc.perform(get("/api/payments/health")).andExpect(status().isOk());
    }

    @Test
    void sinTokenResponde401ConFormatoUniforme() throws Exception {
        mvc.perform(get("/api/payments"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("WWW-Authenticate", "Bearer"))
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
    }

    @Test
    void tokensInvalidosResponden401() throws Exception {
        String[] invalidos = {
                "Bearer basura",
                token("ADMIN", "otro-secreto-distinto-tambien-de-mas-de-32-caracteres", "carwash-platform", Instant.now().plusSeconds(600)),
                token("ADMIN", SECRET, "otra-aplicacion", Instant.now().plusSeconds(600)),
                token("ADMIN", SECRET, "carwash-platform", Instant.now().minusSeconds(600)),
                token("SUPERUSER")
        };
        for (String authorization : invalidos) {
            mvc.perform(get("/api/payments").header("Authorization", authorization))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
        }
    }

    @Test
    void washerNoPuedeConsultarNiRegistrarPagos() throws Exception {
        mvc.perform(get("/api/payments").header("Authorization", token("WASHER")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("FORBIDDEN"));
        mvc.perform(post("/api/payments").header("Authorization", token("WASHER"))
                        .contentType(MediaType.APPLICATION_JSON).content(PAYMENT_BODY))
                .andExpect(status().isForbidden());
    }

    @Test
    void recepcionistaConsultaPagos() throws Exception {
        when(getPaymentsQuery.execute(any())).thenReturn(List.of());
        mvc.perform(get("/api/payments").header("Authorization", token("RECEPTIONIST")))
                .andExpect(status().isOk());
    }

    @Test
    void adminRegistraUnPago() throws Exception {
        Payment payment = new Payment(1L, "o-1", "Ana", new BigDecimal("60.00"), PaymentMethod.QR, "REGISTERED", LocalDateTime.now());
        when(registerPaymentCommand.execute(any(), any(), any(), any())).thenReturn(payment);
        mvc.perform(post("/api/payments").header("Authorization", token("ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON).content(PAYMENT_BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.orderId").value("o-1"));
    }

    @Test
    void ignoraEncabezadosFalsificadosComoXUserRole() throws Exception {
        mvc.perform(get("/api/payments").header("X-User-Role", "ADMIN"))
                .andExpect(status().isUnauthorized());
    }
}
