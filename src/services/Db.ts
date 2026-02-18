import { PrismaClient } from '@prisma/client';
import { AppConfig } from '../config';
import { Logger } from '../utils/logger';

export function createPrismaClient(config: AppConfig, logger: Logger): PrismaClient {
  const prisma = new PrismaClient({
    datasources: {
      db: { url: config.databaseUrl },
    },
    log: ['warn', 'error'],
  });

  process.on('beforeExit', async () => {
    logger.info('Disconnecting Prisma before exit');
    await prisma.$disconnect();
  });

  return prisma;
}
