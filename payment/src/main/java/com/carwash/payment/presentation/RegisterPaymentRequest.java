package com.carwash.payment.presentation;

import java.math.BigDecimal;

public record RegisterPaymentRequest(
        String orderId,
        String customerName,
        BigDecimal amount,
        String method
) {}