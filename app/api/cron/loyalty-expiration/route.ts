import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { validateCronAuth } from '@/lib/cron-auth';
import { processLoyaltyExpirations } from '@/services/loyalty.service';
import { incrementMetric } from '@/lib/observability/metrics';

/**
 * Handler unificado para execução periódica de expiração de pontos de fidelidade.
 * Suporta GET (Vercel Cron / EasyCron) e POST (webhooks / scripts operacionais).
 */
async function handleCron(req: Request) {
  const auth = validateCronAuth(req, 'loyalty-expiration');
  if ('response' in auth) {
    return auth.response;
  }

  const startTime = Date.now();

  try {
    const runId = crypto.randomUUID();
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

    const hasErrors = result.errors.length > 0;
    const runStatus = !hasErrors
      ? 'SUCCESS'
      : result.expiredCount > 0
        ? 'PARTIAL'
        : 'FAILED';
    const completionContext = {
      action: hasErrors
        ? 'CRON_LOYALTY_EXPIRATION_INCOMPLETE'
        : 'CRON_LOYALTY_EXPIRATION_SUCCESS',
      runId,
      runStatus,
      lojaID,
      processedWallets: result.processedWallets,
      expiredCount: result.expiredCount,
      totalPointsExpired: result.totalPointsExpired,
      errorCount: result.errors.length,
      executionTimeMs,
    };

    if (hasErrors) {
      logger.warn('Rotina de expiração de pontos concluída com falhas', completionContext);
    } else {
      logger.info('Rotina de expiração de pontos concluída com sucesso', completionContext);
    }
    incrementMetric('cron_runs_total', {
      job: 'loyalty_expiration',
      result: runStatus.toLowerCase(),
    });

    return NextResponse.json(
      {
        success: !hasErrors,
        status: runStatus,
        runId,
        processedWallets: result.processedWallets,
        expiredCount: result.expiredCount,
        totalPointsExpired: result.totalPointsExpired,
        errorCount: result.errors.length,
        executionTimeMs,
      },
      { status: hasErrors ? 503 : 200 }
    );
  } catch (error: any) {
    incrementMetric('cron_runs_total', { job: 'loyalty_expiration', result: 'failed' });
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
