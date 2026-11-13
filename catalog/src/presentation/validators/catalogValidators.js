const { InvalidRequestError } = require('../../application/errors/ApplicationErrors');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

const CREATE_ALLOWED_FIELDS = new Set(['name', 'description', 'price', 'currency', 'estimatedDuration']);
const UPDATE_ALLOWED_FIELDS = new Set(['name', 'description', 'estimatedDuration']);
const PRICE_ALLOWED_FIELDS = new Set(['price', 'currency']);
const BATCH_ALLOWED_FIELDS = new Set(['ids']);
const PUBLIC_LIST_QUERY_FIELDS = new Set(['page', 'pageSize']);
const ADMIN_LIST_QUERY_FIELDS = new Set(['page', 'pageSize', 'isActive', 'status']);

function validationError(message, details = []) {
  const err = new InvalidRequestError(message);
  err.code = 'VALIDATION_ERROR';
  err.details = details;
  return err;
}

function assertPlainObject(body, label = 'body') {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw validationError(`El cuerpo (${label}) debe ser un objeto JSON válido.`);
  }
}

function rejectUnknownFields(obj, allowedSet, context = 'body') {
  const unknown = Object.keys(obj).filter((key) => !allowedSet.has(key));
  if (unknown.length > 0) {
    throw validationError(
      `Propiedades no permitidas en ${context}: ${unknown.join(', ')}.`,
      unknown.map((field) => ({ field, message: `Propiedad no permitida en ${context}.` }))
    );
  }
}

function validateUuidParam(id, paramName = 'id') {
  if (typeof id !== 'string' || !UUID_REGEX.test(id)) {
    throw validationError(`El parámetro "${paramName}" debe ser un UUID válido.`, [
      { field: paramName, message: 'Debe ser un UUID válido.' }
    ]);
  }
  return id;
}

function parsePositiveIntQuery(rawValue, fieldName, { max } = {}) {
  if (typeof rawValue !== 'string' && typeof rawValue !== 'number') {
    throw validationError(`El parámetro "${fieldName}" debe ser un entero positivo.`, [
      { field: fieldName, message: 'Debe ser un entero positivo.' }
    ]);
  }
  const str = String(rawValue).trim();
  if (!/^\d+$/.test(str)) {
    throw validationError(`El parámetro "${fieldName}" debe ser un entero positivo.`, [
      { field: fieldName, message: 'Debe ser un entero positivo.' }
    ]);
  }
  const num = Number.parseInt(str, 10);
  if (!Number.isInteger(num) || num < 1) {
    throw validationError(`El parámetro "${fieldName}" debe ser mayor o igual a 1.`, [
      { field: fieldName, message: 'Debe ser mayor o igual a 1.' }
    ]);
  }
  if (max !== undefined && num > max) {
    throw validationError(`El parámetro "${fieldName}" no puede superar ${max}.`, [
      { field: fieldName, message: `No puede superar ${max}.` }
    ]);
  }
  return num;
}

function parsePaginationQuery(query = {}) {
  const page =
    query.page === undefined
      ? DEFAULT_PAGE
      : parsePositiveIntQuery(query.page, 'page');
  const pageSize =
    query.pageSize === undefined
      ? DEFAULT_PAGE_SIZE
      : parsePositiveIntQuery(query.pageSize, 'pageSize', { max: MAX_PAGE_SIZE });

  return { page, pageSize };
}

function parsePublicListQuery(query = {}) {
  rejectUnknownFields(query, PUBLIC_LIST_QUERY_FIELDS, 'query');
  return parsePaginationQuery(query);
}

function parseStatusFilter(query = {}) {
  if (query.isActive !== undefined && query.status !== undefined) {
    throw validationError('Utiliza únicamente "isActive" o "status" para filtrar por estado, no ambos.');
  }

  if (query.isActive !== undefined) {
    const val = String(query.isActive).trim().toLowerCase();
    if (val === 'true') return true;
    if (val === 'false') return false;
    throw validationError('El filtro "isActive" solo permite "true" o "false".', [
      { field: 'isActive', message: 'Valores permitidos: true, false.' }
    ]);
  }

  if (query.status !== undefined) {
    const val = String(query.status).trim().toLowerCase();
    if (val === 'active') return true;
    if (val === 'inactive') return false;
    if (val === 'all') return undefined;
    throw validationError('El filtro "status" solo permite "active", "inactive" o "all".', [
      { field: 'status', message: 'Valores permitidos: active, inactive, all.' }
    ]);
  }

  return undefined;
}

function parseAdminListQuery(query = {}) {
  rejectUnknownFields(query, ADMIN_LIST_QUERY_FIELDS, 'query');
  const pagination = parsePaginationQuery(query);
  const isActive = parseStatusFilter(query);

  return isActive === undefined ? pagination : { ...pagination, isActive };
}

function validateNameField(name, { required = true } = {}) {
  if (name === undefined) {
    if (required) {
      throw validationError('El campo "name" es obligatorio.', [
        { field: 'name', message: 'El nombre es obligatorio.' }
      ]);
    }
    return undefined;
  }
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw validationError('El campo "name" debe ser un texto no vacío.', [
      { field: 'name', message: 'Debe ser un texto no vacío.' }
    ]);
  }
  if (name.trim().length > MAX_NAME_LENGTH) {
    throw validationError(`El campo "name" no puede superar ${MAX_NAME_LENGTH} caracteres.`, [
      { field: 'name', message: `Máximo ${MAX_NAME_LENGTH} caracteres.` }
    ]);
  }
  return name.trim();
}

function validateDescriptionField(description) {
  if (description === undefined || description === null) {
    return undefined;
  }
  if (typeof description !== 'string') {
    throw validationError('El campo "description" debe ser un texto.', [
      { field: 'description', message: 'Debe ser un texto.' }
    ]);
  }
  if (description.trim().length > MAX_DESCRIPTION_LENGTH) {
    throw validationError(`El campo "description" no puede superar ${MAX_DESCRIPTION_LENGTH} caracteres.`, [
      { field: 'description', message: `Máximo ${MAX_DESCRIPTION_LENGTH} caracteres.` }
    ]);
  }
  return description.trim();
}

function validatePriceField(price) {
  if (typeof price !== 'number' || !Number.isFinite(price)) {
    throw validationError('El campo "price" es obligatorio y debe ser un número válido.', [
      { field: 'price', message: 'Debe ser un número válido.' }
    ]);
  }
  if (price < 0) {
    throw validationError('El campo "price" no puede ser negativo.', [
      { field: 'price', message: 'No puede ser negativo.' }
    ]);
  }
  const cents = Math.round(price * 100);
  if (Math.abs(price * 100 - cents) > 1e-6) {
    throw validationError('El campo "price" admite como máximo 2 decimales.', [
      { field: 'price', message: 'Máximo 2 decimales.' }
    ]);
  }
  return price;
}

function validateCurrencyField(currency) {
  if (currency === undefined) {
    return 'BOB';
  }
  if (currency !== 'BOB') {
    throw validationError('El campo "currency" debe ser "BOB".', [
      { field: 'currency', message: 'Únicamente se admite la moneda BOB.' }
    ]);
  }
  return currency;
}

function validateDurationField(estimatedDuration, { required = true } = {}) {
  if (estimatedDuration === undefined) {
    if (required) {
      throw validationError('El campo "estimatedDuration" es obligatorio.', [
        { field: 'estimatedDuration', message: 'La duración estimada es obligatoria.' }
      ]);
    }
    return undefined;
  }
  if (typeof estimatedDuration !== 'number' || !Number.isInteger(estimatedDuration) || estimatedDuration <= 0) {
    throw validationError('El campo "estimatedDuration" debe ser un entero positivo (minutos).', [
      { field: 'estimatedDuration', message: 'Debe ser un entero mayor que cero.' }
    ]);
  }
  return estimatedDuration;
}

function validateCreateServiceBody(body) {
  assertPlainObject(body);
  rejectUnknownFields(body, CREATE_ALLOWED_FIELDS);

  return {
    name: validateNameField(body.name, { required: true }),
    description: validateDescriptionField(body.description) ?? '',
    price: validatePriceField(body.price),
    currency: validateCurrencyField(body.currency),
    estimatedDuration: validateDurationField(body.estimatedDuration, { required: true })
  };
}

function validateUpdateServiceBody(body) {
  assertPlainObject(body);
  rejectUnknownFields(body, UPDATE_ALLOWED_FIELDS);

  const name = validateNameField(body.name, { required: false });
  const description = validateDescriptionField(body.description);
  const estimatedDuration = validateDurationField(body.estimatedDuration, { required: false });

  if (name === undefined && description === undefined && estimatedDuration === undefined) {
    throw validationError('Debe enviarse al menos uno de: "name", "description" o "estimatedDuration".');
  }

  return { name, description, estimatedDuration };
}

function validateChangePriceBody(body) {
  assertPlainObject(body);
  rejectUnknownFields(body, PRICE_ALLOWED_FIELDS);

  return {
    price: validatePriceField(body.price),
    currency: validateCurrencyField(body.currency)
  };
}

function validateEmptyActionBody(body) {
  if (body === undefined || body === null) {
    return;
  }
  assertPlainObject(body);
  rejectUnknownFields(body, new Set());
}

function validateBatchServicesBody(body) {
  assertPlainObject(body);
  rejectUnknownFields(body, BATCH_ALLOWED_FIELDS);

  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    throw validationError('El campo "ids" debe ser un arreglo no vacío de UUIDs.', [
      { field: 'ids', message: 'Debe ser un arreglo no vacío de UUIDs.' }
    ]);
  }

  body.ids.forEach((id, index) => {
    if (typeof id !== 'string' || !UUID_REGEX.test(id)) {
      throw validationError(`El elemento ids[${index}] no es un UUID válido.`, [
        { field: `ids[${index}]`, message: 'Debe ser un UUID válido.' }
      ]);
    }
  });

  return { ids: body.ids };
}

module.exports = {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  validateUuidParam,
  parsePublicListQuery,
  parseAdminListQuery,
  validateCreateServiceBody,
  validateUpdateServiceBody,
  validateChangePriceBody,
  validateEmptyActionBody,
  validateBatchServicesBody
};
