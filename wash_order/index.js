const aplicacion = require('./src/app');

const PUERTO = process.env.PORT || 3000;

aplicacion.listen(PUERTO, () => {
  console.log(`Servicio Wash Order ejecutándose en el puerto ${PUERTO}`);
});
