"""Rutas HTTP bajo el prefijo /api/customer/."""

from __future__ import annotations

from django.urls import path

from presentation.views.customers import (
    CustomerActivateView,
    CustomerCollectionView,
    CustomerDeactivateView,
    CustomerDetailView,
    CustomerHistoryView,
    CustomerVehiclesView,
)
from presentation.views.vehicles import (
    VehicleByPlateView,
    VehicleCollectionView,
    VehicleCustomerView,
    VehicleDetailView,
    VehicleHistoryView,
)

urlpatterns = [
    # Clientes
    path("customers", CustomerCollectionView.as_view(), name="customer-list-create"),
    path("customers/<str:customer_id>", CustomerDetailView.as_view(), name="customer-detail"),
    path(
        "customers/<str:customer_id>/activate",
        CustomerActivateView.as_view(),
        name="customer-activate",
    ),
    path(
        "customers/<str:customer_id>/deactivate",
        CustomerDeactivateView.as_view(),
        name="customer-deactivate",
    ),
    path(
        "customers/<str:customer_id>/vehicles",
        CustomerVehiclesView.as_view(),
        name="customer-vehicles",
    ),
    path(
        "customers/<str:customer_id>/history",
        CustomerHistoryView.as_view(),
        name="customer-history",
    ),
    # Vehículos (by-plate antes que <vehicle_id> para evitar colisión de ruta)
    path("vehicles", VehicleCollectionView.as_view(), name="vehicle-create"),
    path(
        "vehicles/by-plate/<str:plate>",
        VehicleByPlateView.as_view(),
        name="vehicle-by-plate",
    ),
    path("vehicles/<str:vehicle_id>", VehicleDetailView.as_view(), name="vehicle-detail"),
    path(
        "vehicles/<str:vehicle_id>/customer",
        VehicleCustomerView.as_view(),
        name="vehicle-customer",
    ),
    path(
        "vehicles/<str:vehicle_id>/history",
        VehicleHistoryView.as_view(),
        name="vehicle-history",
    ),
]
