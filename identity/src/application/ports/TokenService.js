/**
 * Puerto para emitir y verificar tokens de acceso. La infraestructura lo implementa con JWT.
 */
class TokenService {
  /**
   * @param {{ sub: string, role: string, tv: number }} claims
   * @returns {{ accessToken: string, tokenType: 'Bearer', expiresIn: string }}
   */
  issue(claims) {
    throw new Error('TokenService.issue not implemented');
  }

  /**
   * Debe lanzar `InvalidTokenError` si la firma, el emisor, la audiencia o la expiración no son válidos.
   * @param {string} token
   * @returns {{ sub: string, role: string, tv: number }}
   */
  verify(token) {
    throw new Error('TokenService.verify not implemented');
  }
}

module.exports = TokenService;
