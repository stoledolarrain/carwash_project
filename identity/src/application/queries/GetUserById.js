const { toUserDto } = require('../dtos/UserDto');
const { loadUserOrFail } = require('../support/userGuards');

/** Query: detalle de un usuario. También se usa para `GET /auth/me`. */
class GetUserById {
  constructor({ repository }) {
    this.repository = repository;
  }

  /** @param {{ id: string }} input */
  async execute({ id }) {
    return toUserDto(await loadUserOrFail(this.repository, id));
  }
}

module.exports = GetUserById;
