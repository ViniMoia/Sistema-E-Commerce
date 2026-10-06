import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { AuthError } from '@/services/auth.service';

/** Serialize issuance with password reset/block, without doing bcrypt under lock. */
export async function issueAuthenticatedSession(input: {
  userId: string; lojaID: string; password: string; previousSessionId?: string;
}) {
  const candidate = await prisma.user.findUnique({ where: { id: input.userId }, select: { password: true, lojaID: true, status: true } });
  if (!candidate || candidate.lojaID !== input.lojaID || candidate.status !== 'ACTIVE' ||
      !await bcrypt.compare(input.password, candidate.password)) throw new AuthError('Credenciais inválidas.');
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${input.userId} FOR UPDATE`;
    const current = await tx.user.findUnique({ where: { id: input.userId }, select: { password: true, lojaID: true, status: true } });
    if (!current || current.lojaID !== input.lojaID || current.status !== 'ACTIVE' || current.password !== candidate.password) {
      throw new AuthError('Credenciais alteradas. Faça login novamente.');
    }
    if (input.previousSessionId) await tx.session.deleteMany({ where: { id: input.previousSessionId } });
    return tx.session.create({ data: { id: randomBytes(32).toString('hex'), userId: input.userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } });
  });
}
