const { Role } = require('../../domain/value-objects/Role');
const { InvalidRequestError } = require('../errors/ApplicationErrors');
const { toUserDto } = require('../dtos/UserDto');

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * Query (ADMIN): lista paginada de usuarios con filtros por rol, estado y búsqueda por nombre o correo.
 * Con `role=WASHER&isActive=true` sirve para obtener el personal disponible al asignar una orden.
 */
class ListUsers {
  constructor({ repository }) {
    this.repository = repository;
  }

  /** @param {{ role?: string, isActive?: boolean, search?: string, page?: number, pageSize?: number }} [input] */
  async execute({ role, isActive, search, page = 1, pageSize = DEFAULT_PAGE_SIZE } = {}) {
    if (!Number.isInteger(page) || page < 1) {
      throw new InvalidRequestError('page debe ser un entero mayor o igual a 1.');
    }
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
      throw new InvalidRequestError(`pageSize debe ser un entero entre 1 y ${MAX_PAGE_SIZE}.`);
    }

    const filter = { page, pageSize };
    if (role !== undefined) {
      filter.role = new Role(role).value;
    }
    if (isActive !== undefined) {
      filter.isActive = isActive;
    }
    if (typeof search === 'string' && search.trim()) {
      filter.search = search.trim().toLowerCase();
    }

    const { items, total } = await this.repository.findAll(filter);
    return { items: items.map(toUserDto), total, page, pageSize };
  }
}

module.exports = ListUsers;
