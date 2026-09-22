import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { processExpiredOrders } from '@/services/order-timeout.service';

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
    logger.warn('Tentativa não autorizada de execução do cron de timeout', {
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
 * Handler unificado para execução do cancelamento de pedidos expirados via Cron.
 * Suporta GET (padrão Vercel Cron) e POST (padrão webhook / curl).
 */
async function handleCron(req: Request) {
  const auth = validateCronAuth(req);
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const url = new URL(req.url);
    const batchSizeParam = url.searchParams.get('batchSize');
    const lojaID = url.searchParams.get('lojaID') || undefined;

    let batchSize: number | undefined = undefined;
    if (batchSizeParam) {
      const parsed = parseInt(batchSizeParam, 10);
      if (!isNaN(parsed) && parsed > 0) {
        batchSize = Math.min(parsed, 100);
      }
    }

    const summary = await processExpiredOrders({
      batchSize,
      lojaID,
    });

    return NextResponse.json({
      success: summary.success,
      processed: summary.processedCount,
      cancelled: summary.cancelledCount,
      errors: summary.errorCount,
      cancelledOrderIds: summary.cancelledOrderIds,
      executionTimeMs: summary.executionTimeMs,
    });
  } catch (error: any) {
    logger.error('Erro na execução do endpoint de cron de timeout de pedidos', error, {
      action: 'CRON_EXECUTION_FAILED',
    });
    return NextResponse.json(
      { error: 'Erro interno ao processar rotina de timeout de pedidos.' },
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
