const { normalizePagination, formatListResult } = require('./GetActiveServices');
const { InvalidRequestError } = require('../errors/ApplicationErrors');

/** Query administrativa: todos los servicios, incluidos los inactivos (con filtro opcional `isActive`). */
class GetAllServices {
  constructor({ repository }) {
    this.repository = repository;
  }

  /** @param {{ isActive?: boolean, page?: number, pageSize?: number }} [input] */
  async execute(input = {}) {
    if (input.isActive !== undefined && typeof input.isActive !== 'boolean') {
      throw new InvalidRequestError('isActive must be a boolean when provided.');
    }
    const pagination = normalizePagination(input);
    const filter = {};
    if (input.isActive !== undefined) {
      filter.isActive = input.isActive;
    }
    if (pagination) {
      filter.page = pagination.page;
      filter.pageSize = pagination.pageSize;
    }

    const result = await this.repository.findAll(filter);
    return formatListResult(result, pagination);
  }
}

module.exports = GetAllServices;
