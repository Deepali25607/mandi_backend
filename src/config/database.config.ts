import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

/**
 * TypeORM options built from env.
 *
 * - On a host like Render, set `DATABASE_URL` (the managed Postgres connection
 *   string); SSL is enabled automatically. Locally, the discrete DB_* vars are
 *   used (Docker Postgres).
 * - `synchronize` auto-creates the schema from entities (no migrations in this
 *   project). It stays ON unless `DB_SYNC=false`.
 */
export const buildDatabaseConfig = (
  config: ConfigService,
): TypeOrmModuleOptions => {
  const url = config.get<string>('DATABASE_URL');
  // Managed Postgres (Render/Heroku/etc.) requires SSL; default ON when a URL is used.
  const sslOn = config.get<string>('DB_SSL', url ? 'true' : 'false') === 'true';
  const ssl = sslOn ? { rejectUnauthorized: false } : undefined;
  const synchronize = config.get<string>('DB_SYNC', 'true') !== 'false';

  const common: TypeOrmModuleOptions = {
    type: 'postgres',
    autoLoadEntities: true,
    synchronize,
    logging: false,
    ...(ssl ? { ssl, extra: { ssl } } : {}),
  };

  if (url) {
    // Log the target host (never the credentials) so deploy logs confirm where we connect.
    const host = safeHost(url);
    // eslint-disable-next-line no-console
    console.log(`[DB] Using DATABASE_URL → host=${host}, ssl=${sslOn}`);
    return { ...common, url };
  }

  const host = config.get<string>('DB_HOST', 'localhost');
  // eslint-disable-next-line no-console
  console.log(`[DB] No DATABASE_URL set — falling back to host=${host}, ssl=${sslOn}`);
  return {
    ...common,
    host,
    port: Number(config.get('DB_PORT', 5432)),
    username: config.get<string>('DB_USER', 'mandi'),
    password: config.get<string>('DB_PASSWORD', 'mandi'),
    database: config.get<string>('DB_NAME', 'mandi_erp'),
  };
};

/** Extract just the host from a connection URL for safe logging. */
function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unparseable';
  }
}
