/** Exclusive maintenance window. Deploy consistently and drain existing work.
 * This flag cannot control old revisions, independent clients or remote queues.
 */
export function applicationMaintenanceActive() {
  const value = process.env.APP_MAINTENANCE_MODE;
  return value !== undefined && value !== 'false';
}

export function assertApplicationDatabaseAvailable() {
  if (applicationMaintenanceActive()) throw new Error('APP_MAINTENANCE');
}
