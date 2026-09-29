import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

export type CronAuthResult =
  | { authorized: true }
  | { authorized: false; response: NextResponse }

export function validateCronAuth(req: Request, cronName: string): CronAuthResult {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    logger.error('CRON_SECRET não configurado no ambiente do servidor', undefined, {
      action: 'CRON_SECURITY_ALERT',
      cron: cronName,
    })
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Configuração de segurança do cron não inicializada no servidor.' },
        { status: 500 }
      ),
    }
  }

  const authorization = req.headers.get('authorization')
  const alternateHeader = req.headers.get('x-cron-secret')
  const receivedToken = authorization?.startsWith('Bearer ')
    ? authorization.slice(7).trim()
    : alternateHeader?.trim() || null

  if (!receivedToken) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Token de autorização não fornecido.' },
        { status: 401 }
      ),
    }
  }

  const received = Buffer.from(receivedToken)
  const expected = Buffer.from(cronSecret)
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    logger.warn('Tentativa não autorizada de execução de cron', {
      action: 'CRON_UNAUTHORIZED_ATTEMPT',
      cron: cronName,
      ip: req.headers.get('x-forwarded-for')?.split(',')[0].trim() || undefined,
    })
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Token de autorização inválido ou não autorizado.' },
        { status: 401 }
      ),
    }
  }

  return { authorized: true }
}
