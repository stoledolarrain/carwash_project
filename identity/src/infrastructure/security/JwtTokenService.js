const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const TokenService = require('../../application/ports/TokenService');
const { InvalidTokenError } = require('../../application/errors/ApplicationErrors');

const ALGORITHM = 'HS256';

/**
 * Emite y verifica JWT firmados con HS256.
 *
 * Contenido del token (sin datos sensibles): `sub` (id del usuario), `role`, `tv` (versión de token para revocación),
 * `iss`, `aud`, `iat`, `exp` y `jti`.
 * El API Gateway puede verificarlo localmente con el mismo secreto, emisor y audiencia.
 */
class JwtTokenService extends TokenService {
  constructor({ secret, expiresIn = '1h', issuer, audience }) {
    super();
    if (!secret) {
      throw new Error('JwtTokenService requiere un secreto.');
    }
    this.secret = secret;
    this.expiresIn = expiresIn;
    this.issuer = issuer;
    this.audience = audience;
  }

  issue({ sub, role, tv }) {
    const accessToken = jwt.sign({ role, tv }, this.secret, {
      algorithm: ALGORITHM,
      subject: sub,
      issuer: this.issuer,
      audience: this.audience,
      expiresIn: this.expiresIn,
      jwtid: crypto.randomUUID()
    });
    const { exp } = jwt.decode(accessToken);
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.expiresIn,
      expiresAt: new Date(exp * 1000).toISOString()
    };
  }

  verify(token) {
    try {
      const payload = jwt.verify(token, this.secret, {
        algorithms: [ALGORITHM],
        issuer: this.issuer,
        audience: this.audience
      });
      if (typeof payload.sub !== 'string' || typeof payload.role !== 'string' || !Number.isInteger(payload.tv)) {
        throw new InvalidTokenError();
      }
      return { sub: payload.sub, role: payload.role, tv: payload.tv };
    } catch (err) {
      if (err instanceof InvalidTokenError) {
        throw err;
      }
      if (err instanceof jwt.TokenExpiredError) {
        throw new InvalidTokenError('El token de acceso expiró. Inicie sesión nuevamente.');
      }
      throw new InvalidTokenError();
    }
  }
}

module.exports = JwtTokenService;
