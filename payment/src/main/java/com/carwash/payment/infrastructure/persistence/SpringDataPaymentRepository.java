package com.carwash.payment.infrastructure.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface SpringDataPaymentRepository extends JpaRepository<PaymentEntity, Long> {
    Optional<PaymentEntity> findByOrderId(String orderId);
}