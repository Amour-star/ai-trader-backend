import { loadConfig } from './config';
import { createServer } from './server';
import { Logger } from './utils/logger';

const logger = new Logger('bootstrap');

async function bootstrap() {
  const config = loadConfig();
  const appServer = createServer(config);

  process.on('uncaughtException', (error) => {
    logger.error('uncaughtException', { error: error.message, stack: error.stack });
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('unhandledRejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
    });
  });

  process.on('SIGINT', () => {
    void appServer.shutdown('SIGINT').finally(() => process.exit(0));
  });

  process.on('SIGTERM', () => {
    void appServer.shutdown('SIGTERM').finally(() => process.exit(0));
  });

  await appServer.start();
}

void bootstrap().catch((error) => {
  logger.error('Fatal startup error', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
