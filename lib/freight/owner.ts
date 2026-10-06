import { cookies } from 'next/headers';
import { createHash, randomBytes } from 'node:crypto';

export async function freightOwnerForRequest(lojaID: string,
  user: { id: string; lojaID: string; status: string } | null, issue = false): Promise<string | undefined> {
  if (user) {
    if (user.lojaID !== lojaID || user.status !== 'ACTIVE') throw new Error('FREIGHT_OWNER_FORBIDDEN');
    return `u:${user.id}`;
  }
  const jar = await cookies(); let bearer = jar.get('freight_owner')?.value;
  if (!bearer || !/^[a-f0-9]{64}$/.test(bearer)) {
    if (!issue) return undefined;
    bearer = randomBytes(32).toString('hex');
    jar.set('freight_owner', bearer, { httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', path: '/', maxAge: 24 * 60 * 60 });
  }
  return `g:${createHash('sha256').update(bearer).digest('hex')}`;
}
