import { EntityManager } from 'typeorm';

/**
 * Next document number for an org: highest existing numeric suffix + 1.
 *
 * NEVER derive document numbers from a row COUNT — after any deletion the
 * count points at a number that may still exist, and the unique
 * (organization_id, number) index then rejects the insert with a 500.
 * (This exact bug broke sale creation in production.)
 */
export async function nextDocNumber(
  em: EntityManager,
  table: string,
  column: string,
  prefix: string,
  organizationId: string,
  pad = 4,
): Promise<string> {
  const rows: { max: string | number | null }[] = await em.query(
    `SELECT COALESCE(MAX((substring(${column} from '[0-9]+$'))::int), 0) AS max
       FROM ${table} WHERE organization_id = $1`,
    [organizationId],
  );
  const max = Number(rows[0]?.max ?? 0);
  return `${prefix}-${String(max + 1).padStart(pad, '0')}`;
}
