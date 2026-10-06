import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { createFixtureStore } from './fixture-scope'
import { randomUUID } from 'node:crypto'

async function createAdminSession(lojaID: string): Promise<string> {
  await createFixtureStore(lojaID)
  const hashedPassword = await bcrypt.hash('test123456', 10)

  const adminUser = await prisma.user.create({
    data: {
      name: 'Admin Test',
      email: `admin-${randomUUID()}@test.com`,
      password: hashedPassword,
      role: 'ADMIN',
      status: 'ACTIVE',
      lojaID
    }
  })

  const session = await prisma.session.create({
    data: {
      id: `session-${adminUser.id}`,
      userId: adminUser.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
  })

  return session.id
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
  const lojaID = await createFixtureStore()
  const sessionId = await createAdminSession(lojaID)

  return {
    lojaID,
    headers: {
      Cookie: `session_id=${sessionId}`
    }
  }
}
