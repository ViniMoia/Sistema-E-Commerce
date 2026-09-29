import prisma from '@/lib/prisma'
import { registerTestStore } from '@/tests/setup/db'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { hashSessionToken } from '@/lib/session-token'

async function createAdminSession(lojaID: string): Promise<string> {
  let adminUser = await prisma.user.findFirst({
    where: { lojaID, role: 'ADMIN', status: 'ACTIVE' }
  })

  if (!adminUser) {
    const hashedPassword = await bcrypt.hash('test123456', 10)
    adminUser = await prisma.user.create({
      data: {
        name: 'Admin Test',
        email: `admin-${lojaID.substring(0, 8)}@test.com`,
        password: hashedPassword,
        role: 'ADMIN',
        status: 'ACTIVE',
        lojaID
      }
    })
  }

  const token = randomBytes(32).toString('hex')
  await prisma.session.create({
    data: {
      id: hashSessionToken(token),
      userId: adminUser.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
  })

  return token
}

export async function createAdminToken(lojaID: string): Promise<string> {
  return createAdminSession(lojaID)
}

export async function createAuthHeaders(lojaID: string): Promise<Record<string, string>> {
  const token = await createAdminToken(lojaID)
  return {
    Cookie: `session_id=${token}`
  }
}

export async function createDifferentStoreAdmin(): Promise<{
  lojaID: string
  headers: Record<string, string>
}> {
  const otherLoja = await prisma.loja.create({
    data: {
      name: 'Loja Teste secondary',
      slug: `secondary-store-${Date.now()}`,
      description: 'Loja secundária para testes',
      coverImageUrl: 'https://example.com/cover2.jpg'
    }
  })

  registerTestStore(otherLoja.id)
  const sessionId = await createAdminSession(otherLoja.id)

  return {
    lojaID: otherLoja.id,
    headers: {
      Cookie: `session_id=${sessionId}`,
      Host: `${otherLoja.slug}.audit.invalid`
    }
  }
}
