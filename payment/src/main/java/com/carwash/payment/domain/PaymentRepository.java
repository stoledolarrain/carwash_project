package com.carwash.payment.domain;

import java.util.List;
import java.util.Optional;

public interface PaymentRepository {
    Payment save(Payment payment);
    List<Payment> findAll();
    Optional<Payment> findByOrderId(String orderId);
}