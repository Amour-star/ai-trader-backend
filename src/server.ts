import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import { Server } from 'node:http';
import { AppConfig, sanitizedConfig } from './config';
import { EngineRunner } from './engine/EngineRunner';
import { ExecutionEngine } from './engine/ExecutionEngine';
import { RiskGuards } from './engine/RiskGuards';
import { StrategyCoordinator } from './engine/StrategyCoordinator';
import { forceTradeRoute } from './routes/forceTrade';
import { healthRoute } from './routes/health';
import { settingsRoute } from './routes/settings';
import { statusRoute } from './routes/status';
import { decisionsRoute, tradesRoute } from './routes/trades';
import { BinanceMarketData } from './services/BinanceMarketData';
import { connectPrismaWithRetry, createPrismaClient } from './services/Db';
import { PositionStore } from './services/PositionStore';
import { TradeStore } from './services/TradeStore';
import { asyncHandler } from './utils/asyncHandler';
import { Logger } from './utils/logger';

export function createServer(config: AppConfig) {
  const appLogger = new Logger('server');
  const prisma = createPrismaClient(config);

  const marketData = new BinanceMarketData(new Logger('market-data'));
  const tradeStore = new TradeStore(prisma);
  const positionStore = new PositionStore(prisma);
  const execution = new ExecutionEngine(tradeStore, positionStore, new Logger('execution-engine'));
  const strategy = new StrategyCoordinator();
  const risk = new RiskGuards(positionStore);

  let threshold = config.confidenceThreshold;
  let testSignalMode = false;

  const runner = new EngineRunner(
    config.symbol,
    () => threshold,
    marketData,
    strategy,
    tradeStore,
    execution,
    risk,
    { lastHeartbeatTs: null, evaluations: 0, signals: 0, tradesExecuted: 0, isRunning: false },
    () => testSignalMode,
    new Logger('engine-runner'),
  );

  const app = express();
  const startedAt = Date.now();
  let server: Server | null = null;

  app.use(express.json());
  app.use(cors({ origin: config.corsOrigin || '*', credentials: true }));

  app.get('/', (_req, res) => {
    res.json({ status: 'ok', service: 'ai-trader-backend' });
  });
  app.get('/health', asyncHandler(healthRoute(runner, tradeStore, startedAt)));
  app.get('/api/status', asyncHandler(statusRoute(config, () => threshold)));
  app.get('/api/trades', asyncHandler(tradesRoute(tradeStore)));
  app.get('/api/decisions', asyncHandler(decisionsRoute(tradeStore)));
  app.post('/api/force-trade', asyncHandler(forceTradeRoute(marketData, tradeStore, execution)));
  app.post('/api/settings', asyncHandler(settingsRoute(prisma, (value) => {
    threshold = value;
  })));
  app.post('/api/test-signal-mode', (req, res) => {
    testSignalMode = Boolean(req.body?.enabled);
    res.json({ enabled: testSignalMode });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    appLogger.error('Unhandled route error', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' } });
  });

  async function start() {
    await connectPrismaWithRetry(prisma, new Logger('prisma'), 3);

    await new Promise<void>((resolve) => {
      const port = Number(process.env.PORT) || 8080;
      server = app.listen(port, '0.0.0.0', () => {
        appLogger.info('Server started', { ...sanitizedConfig(config), port, host: '0.0.0.0' });
        if (config.engineMode === 'paper') {
          runner.start();
          appLogger.info('Engine started', { mode: config.engineMode });
        } else {
          appLogger.warn('Engine disabled by config', { mode: config.engineMode });
        }
        resolve();
      });
    });

    return { app, server: server as Server, runner, prisma };
  }

  async function shutdown(signal: string) {
    appLogger.warn('Shutdown initiated', { signal });
    runner.stop();

    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }

    await prisma.$disconnect();
    appLogger.info('Shutdown complete');
  }

  return { app, start, shutdown };
}
