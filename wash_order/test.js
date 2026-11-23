require('dotenv').config({ quiet: true });

// Si el .env no define JWT_SECRET, las pruebas usan uno propio. Debe fijarse antes de cargar la app.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-solo-para-las-pruebas-de-wash-order-0000';

const assert = require('node:assert');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const aplicacion = require('./src/app');
const { pool } = require('./src/infrastructure/database/postgres');
const {
  KafkaOrderEventPublisher,
  busEventos,
  TOPIC_ORDENES,
  ORIGEN_SERVICIO
} = require('./src/infrastructure/events/eventEmitter');

/** Emite un JWT con el mismo formato que Identity Service, firmado con el JWT_SECRET de la prueba. */
function emitirToken(role) {
  return jwt.sign({ role, tv: 0 }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: crypto.randomUUID(),
    issuer: process.env.JWT_ISSUER || 'carwash-identity',
    audience: process.env.JWT_AUDIENCE || 'carwash-platform',
    expiresIn: '10m'
  });
}

/** fetch que agrega `Authorization: Bearer <token>` a cada petición. */
function fetchComo(token) {
  return (url, opciones = {}) =>
    fetch(url, { ...opciones, headers: { ...(opciones.headers || {}), Authorization: `Bearer ${token}` } });
}

const fetchAdmin = fetchComo(emitirToken('ADMIN'));

async function ejecutarPruebas() {
  const servidor = aplicacion.listen(0);
  const { port } = servidor.address();
  const urlBase = `http://127.0.0.1:${port}/api/orders`;
  const clienteUuid = crypto.randomUUID();

  try {
    console.log('--- Seguridad: sin token -> 401 y un WASHER no puede crear órdenes -> 403 ---');
    const respuestaSinToken = await fetch(urlBase);
    assert.strictEqual(respuestaSinToken.status, 401);
    const respuestaLavador = await fetchComo(emitirToken('WASHER'))(urlBase, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placaVehiculo: '1234-abc', servicios: ['LAVADO_BASICO'] })
    });
    assert.strictEqual(respuestaLavador.status, 403);
    console.log('Autenticación y autorización por rol verificadas.\n');

    console.log('--- 0. Validando que clienteId rechace valores que no sean UUID ("CLI-100") ---');
    const respuestaClienteInvalido = await fetchAdmin(urlBase, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        placaVehiculo: '1234-abc',
        clienteId: 'CLI-100',
        servicios: ['LAVADO_BASICO']
      })
    });
    assert.strictEqual(respuestaClienteInvalido.status, 400);
    console.log('clienteId no-UUID rechazado correctamente.');

    console.log('\n--- 1. Creando orden en estado inicial EN_ESPERA con clienteId UUID ---');
    const respuestaCreacion = await fetchAdmin(urlBase, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        placaVehiculo: '1234-abc',
        clienteId: clienteUuid,
        servicios: ['LAVADO_BASICO', 'ENCERADO'],
        precioTotal: 85.5
      })
    });

    assert.strictEqual(respuestaCreacion.status, 201);
    const ordenCreada = await respuestaCreacion.json();
    assert.strictEqual(ordenCreada.estado, 'EN_ESPERA');
    assert.strictEqual(ordenCreada.placaVehiculo, '1234-ABC');
    assert.strictEqual(ordenCreada.clienteId, clienteUuid);
    assert.strictEqual(ordenCreada.precioTotal, 85.5);
    console.log('Orden creada correctamente:', ordenCreada);

    console.log('\n--- 2. Validando Patrón State (intentar pasar de EN_ESPERA a LISTO sin iniciar lavado) ---');
    const respuestaInvalida = await fetchAdmin(`${urlBase}/${ordenCreada.id}/complete`, {
      method: 'POST'
    });

    assert.strictEqual(respuestaInvalida.status, 400);
    const errorTransicion = await respuestaInvalida.json();
    console.log('Transición inválida a LISTO bloqueada correctamente:', errorTransicion);

    console.log('\n--- 3. Asignando responsable e iniciando lavado (EN_ESPERA -> EN_PROCESO) ---');
    const respuestaInicio = await fetchAdmin(`${urlBase}/${ordenCreada.id}/start`, {
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
    const respuestaEntregaInvalida = await fetchAdmin(`${urlBase}/${ordenCreada.id}/deliver`, {
      method: 'POST'
    });

    assert.strictEqual(respuestaEntregaInvalida.status, 400);
    const errorEntrega = await respuestaEntregaInvalida.json();
    console.log('Transición inválida a ENTREGADO bloqueada correctamente:', errorEntrega);

    console.log('\n--- 5. Finalizando lavado (EN_PROCESO -> LISTO) ---');
    const respuestaFinalizacion = await fetchAdmin(`${urlBase}/${ordenCreada.id}/complete`, {
      method: 'POST'
    });

    assert.strictEqual(respuestaFinalizacion.status, 200);
    const ordenLista = await respuestaFinalizacion.json();
    assert.strictEqual(ordenLista.estado, 'LISTO');
    console.log('Orden finalizada (LISTO):', ordenLista);

    console.log('\n--- 6. Entregando vehículo al cliente (LISTO -> ENTREGADO) ---');
    const respuestaEntrega = await fetchAdmin(`${urlBase}/${ordenCreada.id}/deliver`, {
      method: 'POST'
    });

    assert.strictEqual(respuestaEntrega.status, 200);
    const ordenEntregada = await respuestaEntrega.json();
    assert.strictEqual(ordenEntregada.estado, 'ENTREGADO');
    assert.ok(ordenEntregada.fechaEntrega);
    console.log('Orden entregada (ENTREGADO):', ordenEntregada);

    console.log('\n--- 7. Verificando contrato de publicación Kafka (topic, key, origen y payload completo) ---');
    const mensajesKafkaCapturados = [];
    const producerSimulado = {
      connect: async () => {},
      send: async (paquete) => {
        mensajesKafkaCapturados.push(paquete);
      },
      disconnect: async () => {}
    };
    const publicadorPrueba = new KafkaOrderEventPublisher({ producer: producerSimulado });
    await publicadorPrueba.emitir('WashDelivered', {
      id: ordenEntregada.id,
      placaVehiculo: ordenEntregada.placaVehiculo,
      clienteId: ordenEntregada.clienteId,
      servicios: ordenEntregada.servicios,
      precioTotal: ordenEntregada.precioTotal,
      responsableId: ordenEntregada.responsableId,
      estado: ordenEntregada.estado,
      fechaCreacion: ordenEntregada.fechaCreacion,
      fechaEntrega: ordenEntregada.fechaEntrega
    });

    assert.strictEqual(mensajesKafkaCapturados.length, 1);
    assert.strictEqual(mensajesKafkaCapturados[0].topic, TOPIC_ORDENES);
    assert.strictEqual(mensajesKafkaCapturados[0].messages[0].key, ordenEntregada.id);
    const sobreParseado = JSON.parse(mensajesKafkaCapturados[0].messages[0].value);
    assert.strictEqual(sobreParseado.origen, ORIGEN_SERVICIO);
    assert.strictEqual(sobreParseado.aggregateId, ordenEntregada.id);
    assert.strictEqual(sobreParseado.datos.id, ordenEntregada.id);
    assert.strictEqual(sobreParseado.datos.placaVehiculo, '1234-ABC');
    assert.strictEqual(sobreParseado.datos.clienteId, clienteUuid);
    assert.deepStrictEqual(sobreParseado.datos.servicios, ['LAVADO_BASICO', 'ENCERADO']);
    assert.strictEqual(sobreParseado.datos.precioTotal, 85.5);
    assert.strictEqual(sobreParseado.datos.estado, 'ENTREGADO');
    assert.ok(sobreParseado.datos.fechaCreacion);
    assert.ok(sobreParseado.datos.fechaEntrega);
    console.log('Contrato de evento Kafka verificado:', sobreParseado);

    console.log('\n--- 8. Consultando orden por ID y por placa (CQRS Lecturas) ---');
    const respuestaPorId = await fetchAdmin(`${urlBase}/${ordenCreada.id}`);
    assert.strictEqual(respuestaPorId.status, 200);
    const ordenConsultada = await respuestaPorId.json();
    assert.strictEqual(ordenConsultada.id, ordenCreada.id);
    assert.strictEqual(ordenConsultada.estado, 'ENTREGADO');

    const respuestaPorPlaca = await fetchAdmin(`${urlBase}/vehicle/1234-abc`);
    assert.strictEqual(respuestaPorPlaca.status, 200);
    const historialPlaca = await respuestaPorPlaca.json();
    assert.ok(Array.isArray(historialPlaca) && historialPlaca.length >= 1);
    console.log(`Historial para placa 1234-ABC: ${historialPlaca.length} orden(es) encontrada(s)`);

    console.log('\n--- 9. Consultando resumen para el dashboard (CQRS Lectura) ---');
    const respuestaResumen = await fetchAdmin(`${urlBase}/summary`);
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
    await busEventos.desconectar();
    await pool.end();
  }
}

ejecutarPruebas().catch((error) => {
  console.error('Error en las pruebas:', error);
  process.exit(1);
});
