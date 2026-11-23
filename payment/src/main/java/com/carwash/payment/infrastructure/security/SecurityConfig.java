package com.carwash.payment.infrastructure.security;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimNames;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;

import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Set;

/**
 * Seguridad de Payment Service: verifica los JWT emitidos por Identity Service.
 *
 * - Firma HS256 con el mismo JWT_SECRET de identity y api-gateway, expiración, emisor y audiencia.
 * - El rol se toma del claim "role" del token firmado (nunca de encabezados como X-User-Role).
 * - Registrar y consultar pagos: ADMIN y RECEPTIONIST (permiso payments:register de Identity).
 * - Sin sesiones ni CSRF: cada petición trae su token (API sin estado).
 * - Errores 401/403 con el mismo formato que el resto de microservicios: {"error":{"code","message"}}.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    static final int MIN_SECRET_LENGTH = 32;
    static final Set<String> VALID_ROLES = Set.of("ADMIN", "RECEPTIONIST", "WASHER");

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, JwtDecoder jwtDecoder) throws Exception {
        AuthenticationEntryPoint unauthorized = (request, response, ex) -> {
            response.setHeader("WWW-Authenticate", "Bearer");
            writeError(response, HttpServletResponse.SC_UNAUTHORIZED, "UNAUTHORIZED",
                    "Se requiere un token de acceso válido (Authorization: Bearer <token>).");
        };
        AccessDeniedHandler forbidden = (request, response, ex) ->
                writeError(response, HttpServletResponse.SC_FORBIDDEN, "FORBIDDEN",
                        "No tiene permisos suficientes para realizar esta operación.");

        http
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.GET, "/api/payments/health").permitAll()
                        .requestMatchers("/error").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/payments").hasAnyRole("ADMIN", "RECEPTIONIST")
                        .requestMatchers(HttpMethod.GET, "/api/payments").hasAnyRole("ADMIN", "RECEPTIONIST")
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth2 -> oauth2
                        .jwt(jwt -> jwt.decoder(jwtDecoder).jwtAuthenticationConverter(roleConverter()))
                        .authenticationEntryPoint(unauthorized)
                        .accessDeniedHandler(forbidden))
                .exceptionHandling(ex -> ex.authenticationEntryPoint(unauthorized).accessDeniedHandler(forbidden));
        return http.build();
    }

    @Bean
    JwtDecoder jwtDecoder(@Value("${jwt.secret:}") String secret,
                          @Value("${jwt.issuer}") String issuer,
                          @Value("${jwt.audience}") String audience) {
        if (secret == null || secret.length() < MIN_SECRET_LENGTH) {
            throw new IllegalStateException("JWT_SECRET es obligatorio y debe tener al menos " + MIN_SECRET_LENGTH
                    + " caracteres (el mismo de Identity Service). Revise payment/.env.");
        }
        SecretKeySpec key = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();

        OAuth2TokenValidator<Jwt> audienceValidator =
                new JwtClaimValidator<List<String>>(JwtClaimNames.AUD, aud -> aud != null && aud.contains(audience));
        OAuth2TokenValidator<Jwt> roleValidator =
                new JwtClaimValidator<String>("role", role -> role != null && VALID_ROLES.contains(role));
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer(issuer), audienceValidator, roleValidator));
        return decoder;
    }

    /** Convierte el claim "role" (p. ej. "ADMIN") en la autoridad "ROLE_ADMIN" que usa hasAnyRole. */
    private JwtAuthenticationConverter roleConverter() {
        JwtGrantedAuthoritiesConverter authorities = new JwtGrantedAuthoritiesConverter();
        authorities.setAuthoritiesClaimName("role");
        authorities.setAuthorityPrefix("ROLE_");
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(authorities);
        return converter;
    }

    private static void writeError(HttpServletResponse response, int status, String code, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        // Mensajes fijos definidos aquí: no incluyen datos de la petición, así que no hace falta escaparlos.
        response.getWriter().write("{\"error\":{\"code\":\"" + code + "\",\"message\":\"" + message + "\"}}");
    }
}
