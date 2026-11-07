const assert = require('node:assert');
const aplicacion = require('./src/app');

async function ejecutarPruebas() {
  const servidor = aplicacion.listen(0);
  const { port } = servidor.address();
  const urlBase = `http://127.0.0.1:${port}/api/orders`;

  try {
    console.log('--- 1. Creando orden en estado inicial EN_ESPERA ---');
    const respuestaCreacion = await fetch(urlBase, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        placaVehiculo: '1234-abc',
        clienteId: 'CLI-100',
        servicios: ['LAVADO_BASICO', 'ENCERADO'],
        precioTotal: 85.5
      })
    });

    assert.strictEqual(respuestaCreacion.status, 201);
    const ordenCreada = await respuestaCreacion.json();
    assert.strictEqual(ordenCreada.estado, 'EN_ESPERA');
    assert.strictEqual(ordenCreada.placaVehiculo, '1234-ABC');
    assert.strictEqual(ordenCreada.clienteId, 'CLI-100');
    assert.strictEqual(ordenCreada.precioTotal, 85.5);
    console.log('Orden creada correctamente:', ordenCreada);

    console.log('\n--- 2. Validando Patrón State (intentar pasar de EN_ESPERA a LISTO sin iniciar lavado) ---');
    const respuestaInvalida = await fetch(`${urlBase}/${ordenCreada.id}/complete`, {
      method: 'POST'
    });

    assert.strictEqual(respuestaInvalida.status, 400);
    const errorTransicion = await respuestaInvalida.json();
    console.log('Transición inválida a LISTO bloqueada correctamente:', errorTransicion);

    console.log('\n--- 3. Asignando responsable e iniciando lavado (EN_ESPERA -> EN_PROCESO) ---');
    const respuestaInicio = await fetch(`${urlBase}/${ordenCreada.id}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        responsableId: 'EMP-01'
      })
    });

    assert.strictEqual(respuestaInicio.status, 200);
    const ordenEnProceso = await respuestaInicio.json();
    assert.strictEqual(ordenEnProceso.estado, 'EN_PROCESO');
    assert.strictEqual(ordenEnProceso.responsableId, 'EMP-01');
    console.log('Orden en proceso:', ordenEnProceso);

    console.log('\n--- 4. Validando bloqueo de entrega prematura (intentar pasar de EN_PROCESO a ENTREGADO) ---');
    const respuestaEntregaInvalida = await fetch(`${urlBase}/${ordenCreada.id}/deliver`, {
      method: 'POST'
    });

    assert.strictEqual(respuestaEntregaInvalida.status, 400);
    const errorEntrega = await respuestaEntregaInvalida.json();
    console.log('Transición inválida a ENTREGADO bloqueada correctamente:', errorEntrega);

    console.log('\n--- 5. Finalizando lavado (EN_PROCESO -> LISTO) ---');
    const respuestaFinalizacion = await fetch(`${urlBase}/${ordenCreada.id}/complete`, {
      method: 'POST'
    });

    assert.strictEqual(respuestaFinalizacion.status, 200);
    const ordenLista = await respuestaFinalizacion.json();
    assert.strictEqual(ordenLista.estado, 'LISTO');
    console.log('Orden finalizada (LISTO):', ordenLista);

    console.log('\n--- 6. Entregando vehículo al cliente (LISTO -> ENTREGADO) ---');
    const respuestaEntrega = await fetch(`${urlBase}/${ordenCreada.id}/deliver`, {
      method: 'POST'
    });

    assert.strictEqual(respuestaEntrega.status, 200);
    const ordenEntregada = await respuestaEntrega.json();
    assert.strictEqual(ordenEntregada.estado, 'ENTREGADO');
    assert.ok(ordenEntregada.fechaEntrega);
    console.log('Orden entregada (ENTREGADO):', ordenEntregada);

    console.log('\n--- 7. Consultando orden por ID y por placa (CQRS Lecturas) ---');
    const respuestaPorId = await fetch(`${urlBase}/${ordenCreada.id}`);
    assert.strictEqual(respuestaPorId.status, 200);
    const ordenConsultada = await respuestaPorId.json();
    assert.strictEqual(ordenConsultada.id, ordenCreada.id);
    assert.strictEqual(ordenConsultada.estado, 'ENTREGADO');

    const respuestaPorPlaca = await fetch(`${urlBase}/vehicle/1234-abc`);
    assert.strictEqual(respuestaPorPlaca.status, 200);
    const historialPlaca = await respuestaPorPlaca.json();
    assert.ok(Array.isArray(historialPlaca) && historialPlaca.length >= 1);
    console.log(`Historial para placa 1234-ABC: ${historialPlaca.length} orden(es) encontrada(s)`);

    console.log('\n--- 8. Consultando resumen para el dashboard (CQRS Lectura) ---');
    const respuestaResumen = await fetch(`${urlBase}/summary`);
    assert.strictEqual(respuestaResumen.status, 200);
    const resumen = await respuestaResumen.json();
    assert.ok(resumen.total >= 1);
    assert.ok(resumen.entregado >= 1);
    console.log('Resumen del dashboard:', {
      total: resumen.total,
      enEspera: resumen.enEspera,
      enProceso: resumen.enProceso,
      listo: resumen.listo,
      entregado: resumen.entregado
    });

    console.log('\nTodas las pruebas y validaciones pasaron con éxito.');
  } finally {
    servidor.close();
  }
}

ejecutarPruebas().catch((error) => {
  console.error('Error en las pruebas:', error);
  process.exit(1);
});
