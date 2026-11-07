class VehiclePlate {
  constructor(valor) {
    if (!valor || typeof valor !== 'string' || !valor.trim()) {
      throw new Error('La placa del vehículo es obligatoria.');
    }

    const placaNormalizada = valor.trim().toUpperCase();

    if (placaNormalizada.length < 5 || placaNormalizada.length > 10) {
      throw new Error('La placa del vehículo debe tener entre 5 y 10 caracteres.');
    }

    this.valor = placaNormalizada;
    Object.freeze(this);
  }

  toString() {
    return this.valor;
  }
}

module.exports = VehiclePlate;
