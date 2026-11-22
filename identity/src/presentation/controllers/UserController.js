const {
  validateUuidParam,
  validateCreateUserBody,
  validateUpdateProfileBody,
  validateChangeRoleBody,
  validateResetPasswordBody,
  validateEmptyActionBody,
  parseListUsersQuery
} = require('../validators/userValidators');

/** Controlador de administración de usuarios y personal (solo ADMIN). */
class UserController {
  constructor({ commands, queries }) {
    if (!commands || !queries) {
      throw new Error('UserController requiere commands y queries.');
    }
    this.commands = commands;
    this.queries = queries;
    for (const method of [
      'list',
      'getById',
      'create',
      'updateProfile',
      'changeRole',
      'resetPassword',
      'activate',
      'deactivate'
    ]) {
      this[method] = this[method].bind(this);
    }
  }

  /** GET /api/identity/users?role=&isActive=&search=&page=&pageSize= */
  async list(req, res) {
    const filter = parseListUsersQuery(req.query);
    res.status(200).json(await this.queries.listUsers.execute(filter));
  }

  /** GET /api/identity/users/:id */
  async getById(req, res) {
    const id = validateUuidParam(req.params.id);
    res.status(200).json(await this.queries.getUserById.execute({ id }));
  }

  /** POST /api/identity/users */
  async create(req, res) {
    const input = validateCreateUserBody(req.body);
    const user = await this.commands.registerUser.execute(input);
    res.location(`${req.baseUrl}/${user.id}`).status(201).json(user);
  }

  /** PATCH /api/identity/users/:id */
  async updateProfile(req, res) {
    const userId = validateUuidParam(req.params.id);
    const input = validateUpdateProfileBody(req.body);
    res.status(200).json(await this.commands.updateUserProfile.execute({ userId, ...input }));
  }

  /** PATCH /api/identity/users/:id/role */
  async changeRole(req, res) {
    const userId = validateUuidParam(req.params.id);
    const { role } = validateChangeRoleBody(req.body);
    res.status(200).json(await this.commands.changeUserRole.execute({ actorId: req.auth.userId, userId, role }));
  }

  /** PATCH /api/identity/users/:id/password */
  async resetPassword(req, res) {
    const userId = validateUuidParam(req.params.id);
    const { newPassword } = validateResetPasswordBody(req.body);
    res.status(200).json(await this.commands.resetUserPassword.execute({ userId, newPassword }));
  }

  /** PATCH /api/identity/users/:id/activate */
  async activate(req, res) {
    const userId = validateUuidParam(req.params.id);
    validateEmptyActionBody(req.body);
    res.status(200).json(await this.commands.activateUser.execute({ userId }));
  }

  /** PATCH /api/identity/users/:id/deactivate */
  async deactivate(req, res) {
    const userId = validateUuidParam(req.params.id);
    validateEmptyActionBody(req.body);
    res.status(200).json(await this.commands.deactivateUser.execute({ actorId: req.auth.userId, userId }));
  }
}

module.exports = UserController;
