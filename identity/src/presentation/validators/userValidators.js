const { InvalidRequestError } = require('../../application/errors/ApplicationErrors');
const { ROLES } = require('../../domain/value-objects/Role');

/**
 * Validación de borde HTTP: tipos, campos obligatorios y campos desconocidos.
 * Las reglas de negocio (formato de correo, política de contraseña, roles) las vuelve a aplicar el dominio.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_ROLES = Object.values(ROLES);

function fail(message, details) {
  throw new InvalidRequestError(message, details);
}

function ensureObjectBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    fail('El cuerpo de la petición debe ser un objeto JSON.');
  }
  return body;
}

function rejectUnknownFields(body, allowed) {
  const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    fail(
      `Campos no permitidos: ${unknown.join(', ')}.`,
      unknown.map((field) => ({ field, message: 'Campo no permitido.' }))
    );
  }
}

function collectRequiredStrings(body, fields) {
  const details = [];
  for (const field of fields) {
    if (typeof body[field] !== 'string' || body[field].trim().length === 0) {
      details.push({ field, message: 'Es obligatorio y debe ser texto.' });
    }
  }
  return details;
}

function ensureValid(details) {
  if (details.length > 0) {
    fail('La petición contiene datos inválidos.', details);
  }
}

function validateRoleValue(role, details, field = 'role') {
  if (typeof role !== 'string' || !VALID_ROLES.includes(role.trim().toUpperCase())) {
    details.push({ field, message: `Debe ser uno de: ${VALID_ROLES.join(', ')}.` });
  }
}

function validateUuidParam(value, paramName = 'id') {
  if (typeof value !== 'string' || !UUID_REGEX.test(value)) {
    fail(`El parámetro "${paramName}" debe ser un UUID válido.`, [
      { field: paramName, message: 'Debe ser un UUID válido.' }
    ]);
  }
  return value;
}

function validateLoginBody(rawBody) {
  const body = ensureObjectBody(rawBody);
  rejectUnknownFields(body, ['email', 'password']);
  ensureValid(collectRequiredStrings(body, ['email', 'password']));
  return { email: body.email, password: body.password };
}

function validateCreateUserBody(rawBody) {
  const body = ensureObjectBody(rawBody);
  rejectUnknownFields(body, ['email', 'fullName', 'password', 'role']);
  const details = collectRequiredStrings(body, ['email', 'fullName', 'password']);
  validateRoleValue(body.role, details);
  ensureValid(details);
  return { email: body.email, fullName: body.fullName, password: body.password, role: body.role };
}

function validateUpdateProfileBody(rawBody) {
  const body = ensureObjectBody(rawBody);
  rejectUnknownFields(body, ['fullName']);
  ensureValid(collectRequiredStrings(body, ['fullName']));
  return { fullName: body.fullName };
}

function validateChangeRoleBody(rawBody) {
  const body = ensureObjectBody(rawBody);
  rejectUnknownFields(body, ['role']);
  const details = [];
  validateRoleValue(body.role, details);
  ensureValid(details);
  return { role: body.role };
}

function validateChangeOwnPasswordBody(rawBody) {
  const body = ensureObjectBody(rawBody);
  rejectUnknownFields(body, ['currentPassword', 'newPassword']);
  ensureValid(collectRequiredStrings(body, ['currentPassword', 'newPassword']));
  return { currentPassword: body.currentPassword, newPassword: body.newPassword };
}

function validateResetPasswordBody(rawBody) {
  const body = ensureObjectBody(rawBody);
  rejectUnknownFields(body, ['newPassword']);
  ensureValid(collectRequiredStrings(body, ['newPassword']));
  return { newPassword: body.newPassword };
}

/** Las acciones activate/deactivate no reciben datos; se acepta cuerpo vacío o ausente. */
function validateEmptyActionBody(rawBody) {
  if (rawBody === undefined || rawBody === null) {
    return;
  }
  rejectUnknownFields(ensureObjectBody(rawBody), []);
}

function parseBooleanQuery(value, field, details) {
  if (value === undefined) return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  details.push({ field, message: 'Debe ser true o false.' });
  return undefined;
}

function parseIntegerQuery(value, field, details) {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    details.push({ field, message: 'Debe ser un número entero.' });
    return undefined;
  }
  return parsed;
}

function parseListUsersQuery(query = {}) {
  const details = [];
  const filter = {};

  if (query.role !== undefined) {
    validateRoleValue(query.role, details);
    filter.role = query.role;
  }
  const isActive = parseBooleanQuery(query.isActive, 'isActive', details);
  if (isActive !== undefined) filter.isActive = isActive;

  if (query.search !== undefined) {
    if (typeof query.search !== 'string' || query.search.length > 100) {
      details.push({ field: 'search', message: 'Debe ser texto de hasta 100 caracteres.' });
    } else {
      filter.search = query.search;
    }
  }

  const page = parseIntegerQuery(query.page, 'page', details);
  if (page !== undefined) filter.page = page;
  const pageSize = parseIntegerQuery(query.pageSize, 'pageSize', details);
  if (pageSize !== undefined) filter.pageSize = pageSize;

  ensureValid(details);
  return filter;
}

/** Extrae el token de `Authorization: Bearer <token>`. Devuelve null si no viene o tiene otro esquema. */
function extractBearerToken(authorizationHeader) {
  if (typeof authorizationHeader !== 'string') {
    return null;
  }
  const match = authorizationHeader.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
}

module.exports = {
  validateUuidParam,
  validateLoginBody,
  validateCreateUserBody,
  validateUpdateProfileBody,
  validateChangeRoleBody,
  validateChangeOwnPasswordBody,
  validateResetPasswordBody,
  validateEmptyActionBody,
  parseListUsersQuery,
  extractBearerToken
};
