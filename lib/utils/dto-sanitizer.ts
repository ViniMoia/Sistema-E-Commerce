export interface SafeUserDTO {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  phone?: string | null;
  cpfCnpj?: string | null;
  avatarImageUrl?: string | null;
  lojaID: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  defaultAddressId?: string | null;
}

/**
 * Remove com segurança todos os campos sensíveis (hashes de senha, tokens de reset, etc.)
 * de qualquer objeto de usuário antes de enviá-lo nas respostas da API (SEC-006).
 */
export function sanitizeUser<T extends Record<string, any>>(user: T): SafeUserDTO {
  const {
    password: _password,
    resetToken: _resetToken,
    resetTokenExpires: _resetTokenExpires,
    emailVerified: _emailVerified,
    ...safeFields
  } = user;

  return safeFields as unknown as SafeUserDTO;
}
