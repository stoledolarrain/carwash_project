// Debe ir primero: el pool de PostgreSQL y Kafka leen process.env al cargarse sus módulos.
require('dotenv').config({ quiet: true });

const aplicacion = require('./src/app');

const PUERTO = process.env.PORT || 3000;

aplicacion.listen(PUERTO, () => {
  console.log(`Servicio Wash Order ejecutándose en el puerto ${PUERTO}`);
});
