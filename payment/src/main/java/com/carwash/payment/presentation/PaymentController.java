package com.carwash.payment.presentation;

import com.carwash.payment.application.commands.RegisterPaymentCommand;
import com.carwash.payment.application.queries.GetPaymentsQuery;
import com.carwash.payment.domain.Payment;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/payments")
@CrossOrigin(origins = "*")
public class PaymentController {

    private final RegisterPaymentCommand registerPaymentCommand;
    private final GetPaymentsQuery getPaymentsQuery;

    public PaymentController(RegisterPaymentCommand registerPaymentCommand, GetPaymentsQuery getPaymentsQuery) {
        this.registerPaymentCommand = registerPaymentCommand;
        this.getPaymentsQuery = getPaymentsQuery;
    }

    @PostMapping
    public ResponseEntity<?> register(@RequestBody RegisterPaymentRequest request) {
        try {
            Payment payment = registerPaymentCommand.execute(
                    request.orderId(),
                    request.customerName(),
                    request.amount(),
                    request.method()
            );
            return ResponseEntity.status(HttpStatus.CREATED).body(payment);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping
    public ResponseEntity<List<Payment>> getAll(@RequestParam(required = false) String orderId) {
        return ResponseEntity.ok(getPaymentsQuery.execute(orderId));
    }

    @GetMapping("/health")
    public ResponseEntity<?> health() {
        return ResponseEntity.ok(Map.of("service", "payment-service", "status", "UP"));
    }
}