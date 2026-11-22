const { InvalidRequestError } = require('../../application/errors/ApplicationErrors');
const {
  validateLoginBody,
  validateChangeOwnPasswordBody,
  extractBearerToken
} = require('../validators/userValidators');

/**
 * Controlador de autenticación: login, perfil propio, cambio de contraseña, verificación de tokens y roles.
 * Solo traduce HTTP a casos de uso; no contiene reglas de negocio.
 */
class AuthController {
  constructor({ commands, queries }) {
    if (!commands || !queries) {
      throw new Error('AuthController requiere commands y queries.');
    }
    this.commands = commands;
    this.queries = queries;
    this.login = this.login.bind(this);
    this.me = this.me.bind(this);
    this.changeOwnPassword = this.changeOwnPassword.bind(this);
    this.verify = this.verify.bind(this);
    this.listRoles = this.listRoles.bind(this);
  }

  /** POST /api/identity/auth/login */
  async login(req, res) {
    const input = validateLoginBody(req.body);
    const result = await this.commands.authenticateUser.execute(input);
    res.set('Cache-Control', 'no-store');
    res.status(200).json(result);
  }

  /** GET /api/identity/auth/me */
  async me(req, res) {
    const user = await this.queries.getUserById.execute({ id: req.auth.userId });
    res.status(200).json(user);
  }

  /** PATCH /api/identity/auth/me/password */
  async changeOwnPassword(req, res) {
    const input = validateChangeOwnPasswordBody(req.body);
    const user = await this.commands.changeOwnPassword.execute({ userId: req.auth.userId, ...input });
    res.status(200).json({
      message: 'Contraseña actualizada. Los tokens anteriores fueron revocados: inicie sesión nuevamente.',
      user
    });
  }

  /**
   * POST /api/identity/auth/verify
   * Pensado para el API Gateway y otros servicios: recibe el token en `{ "token": "..." }`
   * o en `Authorization: Bearer ...` y responde el contexto del usuario si es válido.
   */
  async verify(req, res) {
    const bodyToken = req.body && typeof req.body === 'object' ? req.body.token : undefined;
    if (bodyToken !== undefined && typeof bodyToken !== 'string') {
      throw new InvalidRequestError('El campo "token" debe ser texto.', [
        { field: 'token', message: 'Debe ser texto.' }
      ]);
    }
    const token = bodyToken || extractBearerToken(req.headers.authorization);
    const context = await this.queries.verifyAccessToken.execute({ token });
    res.status(200).json({ valid: true, ...context });
  }

  /** GET /api/identity/roles */
  async listRoles(_req, res) {
    res.status(200).json(await this.queries.listRoles.execute());
  }
}

module.exports = AuthController;
