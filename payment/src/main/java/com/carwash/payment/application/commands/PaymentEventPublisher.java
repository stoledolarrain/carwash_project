package com.carwash.payment.application.commands;

import com.carwash.payment.domain.Payment;

public interface PaymentEventPublisher {
    void publishPaymentRegistered(Payment payment);
}