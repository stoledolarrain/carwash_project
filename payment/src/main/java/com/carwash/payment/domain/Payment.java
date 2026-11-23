package com.carwash.payment.domain;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class Payment {

    private Long id;
    private String orderId;          // Ej: "CW-0187"
    private String customerName;     // Ej: "Andrea Rojas"
    private BigDecimal amount;       // Ej: 60.00 (En Java el dinero siempre se maneja con BigDecimal)
    private PaymentMethod method;    // EFECTIVO, QR o TARJETA
    private String status;           // Ej: "REGISTERED"
    private LocalDateTime paidAt;

    public Payment(Long id, String orderId, String customerName, BigDecimal amount, PaymentMethod method, String status, LocalDateTime paidAt) {
        if (orderId == null || orderId.isBlank()) {
            throw new IllegalArgumentException("El ID de la orden (orderId) es obligatorio para registrar un pago.");
        }
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("El monto del pago debe ser mayor a 0.");
        }
        if (method == null) {
            throw new IllegalArgumentException("El método de pago es obligatorio (EFECTIVO, QR o TARJETA).");
        }

        this.id = id;
        this.orderId = orderId;
        this.customerName = (customerName != null && !customerName.isBlank()) ? customerName : "Cliente";
        this.amount = amount;
        this.method = method;
        this.status = (status != null) ? status : "REGISTERED";
        this.paidAt = (paidAt != null) ? paidAt : LocalDateTime.now();
    }

    public Long getId() { return id; }
    public String getOrderId() { return orderId; }
    public String getCustomerName() { return customerName; }
    public BigDecimal getAmount() { return amount; }
    public PaymentMethod getMethod() { return method; }
    public String getStatus() { return status; }
    public LocalDateTime getPaidAt() { return paidAt; }
}