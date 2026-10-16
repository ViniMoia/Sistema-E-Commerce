import type { Prisma } from '@prisma/client';

export type OrderReportingScope = 'COMMERCIAL' | 'TEST' | 'ALL';

/** Reporting only. Never use this filter to skip payment obligations/workers. */
export function orderReportingWhere(scope: OrderReportingScope = 'COMMERCIAL'): Prisma.OrderWhereInput {
  if (scope === 'ALL') return {};
  return { reportingExclusion: scope === 'TEST' ? { isNot: null } : { is: null } };
}
