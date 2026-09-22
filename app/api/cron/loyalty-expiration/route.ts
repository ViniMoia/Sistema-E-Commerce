import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { processLoyaltyExpirations } from '@/services/loyalty.service';

/**
 * Validação segura de token Bearer utilizando comparação em tempo constante (timing attack safe).
 */
function validateCronAuth(req: Request): { authorized: boolean; response?: NextResponse } {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logger.error('CRON_SECRET não configurado no ambiente do servidor', undefined, {
      action: 'CRON_SECURITY_ALERT',
    });
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Configuração de segurança do cron não inicializada no servidor.' },
        { status: 500 }
      ),
    };
  }

  const authHeader = req.headers.get('authorization');
  let receivedToken: string | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    receivedToken = authHeader.slice(7).trim();
  } else if (req.headers.get('x-cron-secret')) {
    receivedToken = req.headers.get('x-cron-secret')!.trim();
  }

  if (!receivedToken) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Token de autorização não fornecido.' },
        { status: 401 }
      ),
    };
  }

  const bufReceived = Buffer.from(receivedToken);
  const bufExpected = Buffer.from(cronSecret);

  if (
    bufReceived.length !== bufExpected.length ||
    !crypto.timingSafeEqual(bufReceived, bufExpected)
  ) {
    logger.warn('Tentativa não autorizada de execução do cron de expiração de pontos', {
      action: 'CRON_UNAUTHORIZED_ATTEMPT',
      ip: req.headers.get('x-forwarded-for')?.split(',')[0].trim() || undefined,
    });
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Token de autorização inválido ou não autorizado.' },
        { status: 401 }
      ),
    };
  }

  return { authorized: true };
}

/**
 * Handler unificado para execução periódica de expiração de pontos de fidelidade.
 * Suporta GET (Vercel Cron / EasyCron) e POST (webhooks / scripts operacionais).
 */
async function handleCron(req: Request) {
  const auth = validateCronAuth(req);
  if (!auth.authorized) {
    return auth.response!;
  }

  const startTime = Date.now();

  try {
    const url = new URL(req.url);
    const lojaID = url.searchParams.get('lojaID') || undefined;

    logger.info('Iniciando rotina de expiração periódica de pontos de fidelidade', {
      action: 'CRON_LOYALTY_EXPIRATION_START',
      lojaID,
    });

    const result = await processLoyaltyExpirations({
      lojaID,
      now: new Date(),
    });

    const executionTimeMs = Date.now() - startTime;

    logger.info('Rotina de expiração de pontos concluída com sucesso', {
      action: 'CRON_LOYALTY_EXPIRATION_SUCCESS',
      lojaID,
      processedWallets: result.processedWallets,
      expiredCount: result.expiredCount,
      totalPointsExpired: result.totalPointsExpired,
      errorCount: result.errors.length,
      executionTimeMs,
    });

    return NextResponse.json({
      success: true,
      processedWallets: result.processedWallets,
      expiredCount: result.expiredCount,
      totalPointsExpired: result.totalPointsExpired,
      errors: result.errors,
      executionTimeMs,
    });
  } catch (error: any) {
    const executionTimeMs = Date.now() - startTime;
    logger.error('Erro ao processar rotina de expiração de pontos', error, {
      action: 'CRON_LOYALTY_EXPIRATION_FAILED',
      executionTimeMs,
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno ao processar expiração de pontos de fidelidade.',
      },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  return handleCron(req);
}

export async function POST(req: Request) {
  return handleCron(req);
}
