package com.carwash.payment.infrastructure.persistence;

import com.carwash.payment.domain.Payment;
import com.carwash.payment.domain.PaymentRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public class PostgresPaymentRepository implements PaymentRepository {

    private final SpringDataPaymentRepository jpaRepository;

    public PostgresPaymentRepository(SpringDataPaymentRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public Payment save(Payment payment) {
        PaymentEntity entity = new PaymentEntity();
        entity.setId(payment.getId());
        entity.setOrderId(payment.getOrderId());
        entity.setCustomerName(payment.getCustomerName());
        entity.setAmount(payment.getAmount());
        entity.setMethod(payment.getMethod());
        entity.setStatus(payment.getStatus());
        entity.setPaidAt(payment.getPaidAt());

        PaymentEntity saved = jpaRepository.save(entity);
        return mapToDomain(saved);
    }

    @Override
    public List<Payment> findAll() {
        return jpaRepository.findAll().stream()
                .map(this::mapToDomain)
                .toList();
    }

    @Override
    public Optional<Payment> findByOrderId(String orderId) {
        return jpaRepository.findByOrderId(orderId)
                .map(this::mapToDomain);
    }

    private Payment mapToDomain(PaymentEntity entity) {
        return new Payment(
                entity.getId(),
                entity.getOrderId(),
                entity.getCustomerName(),
                entity.getAmount(),
                entity.getMethod(),
                entity.getStatus(),
                entity.getPaidAt()
        );
    }
}