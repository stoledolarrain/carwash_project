const { ROLE_DEFINITIONS } = require('../../domain/value-objects/Role');

/** Query: catálogo de roles con su descripción y permisos (útil para el frontend y otros servicios). */
class ListRoles {
  async execute() {
    return {
      items: Object.entries(ROLE_DEFINITIONS).map(([role, def]) => ({
        role,
        descripcion: def.descripcion,
        permisos: [...def.permisos]
      }))
    };
  }
}

module.exports = ListRoles;
