import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { validateCronAuth } from '@/lib/cron-auth';
import { processExpiredOrders } from '@/services/order-timeout.service';
import { incrementMetric } from '@/lib/observability/metrics';

/**
 * Handler unificado para execução do cancelamento de pedidos expirados via Cron.
 * Suporta GET (padrão Vercel Cron) e POST (padrão webhook / curl).
 */
async function handleCron(req: Request) {
  const auth = validateCronAuth(req, 'orders-timeout');
  if ('response' in auth) {
    return auth.response;
  }

  try {
    const runId = crypto.randomUUID();
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

    const runStatus = summary.success
      ? 'SUCCESS'
      : summary.cancelledCount > 0
        ? 'PARTIAL'
        : 'FAILED';

    if (!summary.success) {
      logger.warn('Rotina de timeout concluída com falhas', {
        action: 'CRON_ORDERS_TIMEOUT_INCOMPLETE',
        runId,
        runStatus,
        errorCount: summary.errorCount,
        processedCount: summary.processedCount,
      });
    }
    incrementMetric('cron_runs_total', {
      job: 'orders_timeout',
      result: runStatus.toLowerCase(),
    });

    return NextResponse.json(
      {
        success: summary.success,
        status: runStatus,
        runId,
        processed: summary.processedCount,
        cancelled: summary.cancelledCount,
        errors: summary.errorCount,
        cancelledOrderIds: summary.cancelledOrderIds,
        executionTimeMs: summary.executionTimeMs,
      },
      { status: summary.success ? 200 : 503 }
    );
  } catch (error: any) {
    incrementMetric('cron_runs_total', { job: 'orders_timeout', result: 'failed' });
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
