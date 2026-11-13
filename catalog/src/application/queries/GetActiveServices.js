const { toServiceDto } = require('../dtos/ServiceDto');
const { InvalidRequestError } = require('../errors/ApplicationErrors');

function normalizePagination({ page, pageSize } = {}) {
  if (page === undefined && pageSize === undefined) {
    return null;
  }
  const resolvedPage = page === undefined ? 1 : Number(page);
  const resolvedPageSize = pageSize === undefined ? 20 : Number(pageSize);

  if (!Number.isInteger(resolvedPage) || resolvedPage < 1) {
    throw new InvalidRequestError('page must be an integer greater than or equal to 1.');
  }
  if (!Number.isInteger(resolvedPageSize) || resolvedPageSize < 1 || resolvedPageSize > 100) {
    throw new InvalidRequestError('pageSize must be an integer between 1 and 100.');
  }
  return { page: resolvedPage, pageSize: resolvedPageSize };
}

function formatListResult(result, pagination) {
  if (Array.isArray(result)) {
    const items = result.map(toServiceDto);
    if (!pagination) {
      return { items, total: items.length };
    }
    const start = (pagination.page - 1) * pagination.pageSize;
    return {
      items: items.slice(start, start + pagination.pageSize),
      total: items.length,
      page: pagination.page,
      pageSize: pagination.pageSize
    };
  }

  const items = result.items.map(toServiceDto);
  if (!pagination) {
    return { items, total: result.total };
  }
  return {
    items,
    total: result.total,
    page: result.page ?? pagination.page,
    pageSize: result.pageSize ?? pagination.pageSize
  };
}

/** Query pública: solo servicios activos. */
class GetActiveServices {
  constructor({ repository }) {
    this.repository = repository;
  }

  /** @param {{ page?: number, pageSize?: number }} [input] */
  async execute(input = {}) {
    const pagination = normalizePagination(input);
    const filter = pagination ? { isActive: true, ...pagination } : { isActive: true };
    const result = await this.repository.findAll(filter);
    return formatListResult(result, pagination);
  }
}

module.exports = GetActiveServices;
module.exports.normalizePagination = normalizePagination;
module.exports.formatListResult = formatListResult;
