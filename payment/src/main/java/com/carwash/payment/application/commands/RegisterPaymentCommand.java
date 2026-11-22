package com.carwash.payment.application.commands;

import com.carwash.payment.domain.Payment;
import com.carwash.payment.domain.PaymentMethod;
import com.carwash.payment.domain.PaymentRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

@Service
public class RegisterPaymentCommand {

    private final PaymentRepository paymentRepository;
    private final PaymentEventPublisher eventPublisher;

    public RegisterPaymentCommand(PaymentRepository paymentRepository, PaymentEventPublisher eventPublisher) {
        this.paymentRepository = paymentRepository;
        this.eventPublisher = eventPublisher;
    }

    public Payment execute(String orderId, String customerName, BigDecimal amount, String methodStr) {
        if (paymentRepository.findByOrderId(orderId).isPresent()) {
            throw new IllegalArgumentException("La orden " + orderId + " ya tiene un pago registrado.");
        }

        PaymentMethod method;
        try {
            method = PaymentMethod.valueOf(methodStr.toUpperCase());
        } catch (Exception e) {
            throw new IllegalArgumentException("Método de pago inválido. Use: EFECTIVO, QR o TARJETA.");
        }

        Payment payment = new Payment(null, orderId, customerName, amount, method, "REGISTERED", null);

        Payment savedPayment = paymentRepository.save(payment);

        eventPublisher.publishPaymentRegistered(savedPayment);

        return savedPayment;
    }
}