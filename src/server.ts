import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import { AppConfig, sanitizedConfig } from './config';
import { EngineRunner } from './engine/EngineRunner';
import { ExecutionEngine } from './engine/ExecutionEngine';
import { RiskGuards } from './engine/RiskGuards';
import { StrategyCoordinator } from './engine/StrategyCoordinator';
import { BinanceMarketData } from './services/BinanceMarketData';
import { createPrismaClient } from './services/Db';
import { PositionStore } from './services/PositionStore';
import { TradeStore } from './services/TradeStore';
import { forceTradeRoute } from './routes/forceTrade';
import { healthRoute } from './routes/health';
import { settingsRoute } from './routes/settings';
import { statusRoute } from './routes/status';
import { decisionsRoute, tradesRoute } from './routes/trades';
import { asyncHandler } from './utils/asyncHandler';
import { Logger } from './utils/logger';

export function createServer(config: AppConfig) {
  const appLogger = new Logger('Server');
  const prisma = createPrismaClient(config, new Logger('Prisma'));

  const marketData = new BinanceMarketData(new Logger('MarketData'));
  const tradeStore = new TradeStore(prisma);
  const positionStore = new PositionStore(prisma);
  const execution = new ExecutionEngine(tradeStore, positionStore, new Logger('ExecutionEngine'));
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
    {
      lastHeartbeatTs: null,
      evaluations: 0,
      signals: 0,
      tradesExecuted: 0,
      isRunning: false,
    },
    () => testSignalMode,
    new Logger('EngineRunner'),
  );

  const app = express();
  const startedAt = Date.now();

  app.use(express.json());
  app.use(cors({ origin: config.corsOrigin }));

  app.get('/health', asyncHandler(healthRoute(runner, tradeStore, startedAt)));
  app.get('/api/status', asyncHandler(statusRoute(prisma, runner, config.symbol)));
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
    appLogger.error('Unhandled route error', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: 'Internal server error' });
  });

  function start() {
    const server = app.listen(config.port, () => {
      appLogger.info('Backend listening', sanitizedConfig(config));
      if (config.engineMode === 'paper') {
        runner.start();
      } else {
        appLogger.warn('Engine mode disabled; runner not started');
      }
    });

    return { app, server, runner, prisma };
  }

  return { app, start };
}
