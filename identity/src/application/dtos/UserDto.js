/**
 * DTO de salida. Nunca incluye `passwordHash` ni `tokenVersion`.
 * @param {import('../../domain/entities/User')} user
 */
function toUserDto(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    permissions: [...user.permissions],
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null
  };
}

module.exports = { toUserDto };
