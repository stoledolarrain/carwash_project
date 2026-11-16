const { InvalidTokenError } = require('../errors/ApplicationErrors');

/**
 * Query: valida un token de acceso y devuelve el contexto de autenticación.
 *
 * Además de la firma y la expiración (las revisa `TokenService`), comprueba contra el estado actual del usuario:
 * - que siga existiendo y esté activo;
 * - que su `tokenVersion` coincida (si cambió contraseña o rol, o fue desactivado, el token quedó revocado);
 * - que el rol del token sea el rol vigente.
 *
 * Lo usan el middleware `authenticate` de este servicio y el endpoint `POST /auth/verify` para el API Gateway.
 */
class VerifyAccessToken {
  constructor({ repository, tokenService }) {
    this.repository = repository;
    this.tokenService = tokenService;
  }

  /** @param {{ token: string }} input @returns {Promise<{ userId: string, email: string, role: string, permissions: string[] }>} */
  async execute({ token }) {
    if (typeof token !== 'string' || token.length === 0) {
      throw new InvalidTokenError('Se requiere un token de acceso.');
    }

    const claims = this.tokenService.verify(token);
    const user = await this.repository.findById(claims.sub);

    if (!user || !user.isActive || user.tokenVersion !== claims.tv || user.role !== claims.role) {
      throw new InvalidTokenError();
    }

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      permissions: [...user.permissions]
    };
  }
}

module.exports = VerifyAccessToken;
