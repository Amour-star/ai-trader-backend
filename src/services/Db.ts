import { PrismaClient } from '@prisma/client';
import { AppConfig } from '../config';
import { Logger } from '../utils/logger';

export function createPrismaClient(config: AppConfig): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: config.databaseUrl } },
    log: ['warn', 'error'],
  });
}

export async function connectPrismaWithRetry(prisma: PrismaClient, logger: Logger, attempts = 3) {
  let lastError: unknown;
  for (let index = 1; index <= attempts; index += 1) {
    try {
      await prisma.$connect();
      logger.info('DB connected', { attempt: index });
      return;
    } catch (error) {
      lastError = error;
      logger.error('DB connection attempt failed', {
        attempt: index,
        error: error instanceof Error ? error.message : String(error),
      });
      if (index < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * index));
      }
    }
  }

  throw new Error(`Unable to connect to database after ${attempts} attempts: ${String(lastError)}`);
}
