package com.carwash.payment.application.queries;

import com.carwash.payment.domain.Payment;
import com.carwash.payment.domain.PaymentRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class GetPaymentsQuery {

    private final PaymentRepository paymentRepository;

    public GetPaymentsQuery(PaymentRepository paymentRepository) {
        this.paymentRepository = paymentRepository;
    }

    public List<Payment> execute(String orderId) {
        if (orderId != null && !orderId.isBlank()) {
            return paymentRepository.findByOrderId(orderId)
                    .map(List::of)
                    .orElse(List.of());
        }
        return paymentRepository.findAll();
    }
}