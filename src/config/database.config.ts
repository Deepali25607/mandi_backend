import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

/**
 * TypeORM options built from env. `synchronize: true` is enabled in dev so the
 * schema auto-creates from entities; switch to migrations before production.
 */
export const buildDatabaseConfig = (
  config: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: config.get<string>('DB_HOST', 'localhost'),
  port: Number(config.get('DB_PORT', 5432)),
  username: config.get<string>('DB_USER', 'mandi'),
  password: config.get<string>('DB_PASSWORD', 'mandi'),
  database: config.get<string>('DB_NAME', 'mandi_erp'),
  autoLoadEntities: true,
  synchronize: config.get('NODE_ENV') !== 'production',
  logging: false,
});
