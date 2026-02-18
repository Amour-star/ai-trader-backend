import { loadConfig } from './config';
import { createServer } from './server';
import { Logger } from './utils/logger';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  try {
    const config = loadConfig();
    const { start } = createServer(config);
    start();
  } catch (error) {
    logger.error('Fatal startup error', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

void bootstrap();
